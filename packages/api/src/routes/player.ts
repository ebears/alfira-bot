import { getPlayer } from '@alfira-bot/bot';
import { fisherYatesShuffle, getRequestedBy, type LoopMode, youTubeUrl } from '@alfira-bot/shared';
import { getVoiceConnection } from '@discordjs/voice';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { GUILD_ID } from '../lib/config';
import { requirePlayer, requirePlaying } from '../lib/player';
import { canAccessPlaylist } from '../lib/playlistAccess';
import prisma from '../lib/prisma';
import { buildQueuedSongFromMetadata, dbSongToQueuedSong } from '../lib/songConversion';
import {
  clampMaxVideos,
  fetchPlaylistMetadata,
  fetchYouTubeMetadata,
  validateYouTubePlaylistUrl,
  validateYouTubeUrl,
} from '../lib/validation';
import { resolveOrAutoJoinPlayer } from '../lib/voice';
import { requireAdmin } from '../middleware/requireAdmin';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

// Rate limit player action routes to prevent abuse.
const playerLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

// GET /api/player/queue — returns current queue state. Member accessible.
router.get('/queue', requireAuth, (_req, res) => {
  const player = getPlayer(GUILD_ID);
  const connection = getVoiceConnection(GUILD_ID);

  if (!player) {
    res.json({
      isPlaying: false,
      isPaused: false,
      isConnectedToVoice: !!connection,
      loopMode: 'off',
      isShuffled: false,
      currentSong: null,
      priorityQueue: [],
      queue: [],
      trackStartedAt: null,
    });
    return;
  }

  res.json(player.getQueueState());
});

// POST /api/player/play — load songs and start playback. Member accessible.
router.post('/play', requireAuth, async (req, res) => {
  const { playlistId, mode, loop, startFromSongId } = req.body as {
    playlistId?: string;
    mode?: 'sequential' | 'random';
    loop?: LoopMode;
    startFromSongId?: string;
  };

  const player = await resolveOrAutoJoinPlayer(req, res);
  if (!player) return;

  let dbSongs: Awaited<ReturnType<typeof prisma.song.findMany>>;

  if (playlistId) {
    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId },
      include: {
        songs: {
          orderBy: { position: 'asc' },
          include: { song: true },
        },
      },
    });

    if (!playlist) {
      res.status(404).json({ error: 'Playlist not found.' });
      return;
    }

    if (!canAccessPlaylist(playlist, req.user, res)) return;

    dbSongs = playlist.songs.map((ps) => ps.song);
  } else {
    dbSongs = await prisma.song.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  if (dbSongs.length === 0) {
    res.status(422).json({ error: 'No songs found to play.' });
    return;
  }

  if (startFromSongId) {
    const startIndex = dbSongs.findIndex((s) => s.id === startFromSongId);

    if (startIndex === -1) {
      res.status(404).json({ error: 'Start song not found in playlist.' });
      return;
    }

    dbSongs = [...dbSongs.slice(startIndex), ...dbSongs.slice(0, startIndex)];
  }

  if (mode === 'random') {
    fisherYatesShuffle(dbSongs);
  }

  const targetLoopMode = loop ?? player.getLoopMode();
  player.setLoopMode(targetLoopMode);

  const { username: requestedBy } = getRequestedBy(req);
  const queuedSongs = dbSongs.map((song) => dbSongToQueuedSong(song, requestedBy));

  if (startFromSongId) {
    await player.replaceQueueAndPlay(queuedSongs);
  } else {
    await player.addToQueue(queuedSongs);
  }

  res.json({ message: `Queued ${queuedSongs.length} song(s).` });
});

// POST /api/player/skip — skip current song. Member accessible.
router.post('/skip', requireAuth, playerLimiter, (_req, res) => {
  const player = requirePlaying(res);
  if (!player) return;

  player.skip();
  res.json({ message: 'Skipped.' });
});

// POST /api/player/leave — stop and disconnect. Member accessible.
router.post('/leave', requireAuth, playerLimiter, (_req, res) => {
  const player = getPlayer(GUILD_ID);
  const connection = getVoiceConnection(GUILD_ID);

  if (!player && !connection) {
    res.status(409).json({ error: 'The bot is not in a voice channel.' });
    return;
  }

  if (player) player.stop();
  if (connection) connection.destroy();

  res.json({ message: 'Left the voice channel.' });
});

// POST /api/player/loop — set loop mode. Member accessible.
router.post('/loop', requireAuth, playerLimiter, (req, res) => {
  const { mode } = req.body as { mode?: LoopMode };

  if (!mode || !['off', 'song', 'queue'].includes(mode)) {
    res.status(400).json({ error: 'mode must be "off", "song", or "queue".' });
    return;
  }

  const player = requirePlayer(res);
  if (!player) return;

  player.setLoopMode(mode);
  res.json({ loopMode: mode });
});

// POST /api/player/shuffle — shuffle queue. Admin only.
router.post('/shuffle', requireAuth, requireAdmin, (_req, res) => {
  const player = getPlayer(GUILD_ID);

  if (!player || player.getQueue().length === 0) {
    res.status(409).json({ error: 'No songs in the queue to shuffle.' });
    return;
  }

  player.shuffle();
  res.json({ message: 'Queue shuffled.' });
});

// POST /api/player/unshuffle — restore original queue order. Admin only.
router.post('/unshuffle', requireAuth, requireAdmin, (_req, res) => {
  const player = requirePlayer(res);
  if (!player) return;

  player.unshuffle();
  res.json({ message: 'Queue order restored.' });
});

// POST /api/player/quick-add — add YouTube URL to priority queue. Member accessible.
router.post('/quick-add', requireAuth, playerLimiter, async (req, res) => {
  const url = validateYouTubeUrl(req.body.youtubeUrl, res);
  if (!url) return;

  const player = await resolveOrAutoJoinPlayer(req, res);
  if (!player) return;

  const metadata = await fetchYouTubeMetadata(url, res);
  if (!metadata) return;

  const { username: requestedBy, discordId: addedBy } = getRequestedBy(req);
  const queuedSong = buildQueuedSongFromMetadata(metadata, url, requestedBy, addedBy);

  await player.addToPriorityQueue(queuedSong);

  res.json({
    message: `Added "${metadata.title}" to the queue.`,
    song: queuedSong,
  });
});

// POST /api/player/quick-add-playlist — add playlist to queue. Member accessible.
router.post('/quick-add-playlist', requireAuth, playerLimiter, async (req, res) => {
  const maxVideos = clampMaxVideos((req.body as { maxVideos?: number }).maxVideos);
  const url = validateYouTubePlaylistUrl(req.body.youtubeUrl, res);
  if (!url) return;

  const player = await resolveOrAutoJoinPlayer(req, res);
  if (!player) return;

  const playlistMetadata = await fetchPlaylistMetadata(url, res, maxVideos);
  if (!playlistMetadata) return;

  const { username: requestedBy, discordId: addedBy } = getRequestedBy(req);
  const queuedSongs = playlistMetadata.videos.map((video) =>
    buildQueuedSongFromMetadata(
      {
        title: video.title,
        youtubeId: video.id,
        duration: video.duration,
        thumbnailUrl: video.thumbnailUrl,
      },
      youTubeUrl(video.id),
      requestedBy,
      addedBy
    )
  );

  await player.addToQueue(queuedSongs);

  res.json({
    message: `Added ${queuedSongs.length} song(s) from "${playlistMetadata.title}" to the queue.`,
    playlistTitle: playlistMetadata.title,
    totalVideos: playlistMetadata.videoCount,
    queuedCount: queuedSongs.length,
    songs: queuedSongs,
  });
});

// POST /api/player/pause-toggle — pause/resume. Member accessible.
router.post('/pause-toggle', requireAuth, playerLimiter, (_req, res) => {
  const player = requirePlaying(res);
  if (!player) return;

  const isPaused = player.togglePause();
  res.json({ isPaused });
});

// POST /api/player/clear — clear queue. Admin only.
router.post('/clear', requireAuth, requireAdmin, (_req, res) => {
  const player = requirePlayer(res);
  if (!player) return;

  player.clearQueue();
  res.json({ message: 'Queue cleared.' });
});

// POST /api/player/add-to-priority — add library song to Up Next. Member accessible.
router.post('/add-to-priority', requireAuth, async (req, res) => {
  const { songId } = req.body as { songId?: string };

  if (!songId || typeof songId !== 'string') {
    res.status(400).json({ error: 'songId is required.' });
    return;
  }

  const song = await prisma.song.findUnique({
    where: { id: songId },
  });

  if (!song) {
    res.status(404).json({ error: 'Song not found.' });
    return;
  }

  const player = await resolveOrAutoJoinPlayer(req, res);
  if (!player) return;

  const { username: requestedBy } = getRequestedBy(req);
  const queuedSong = dbSongToQueuedSong(song, requestedBy);

  await player.addToPriorityQueue(queuedSong);

  res.json({
    message: `Added "${song.nickname || song.title}" to Up Next.`,
    song: queuedSong,
  });
});

// POST /api/player/override — immediately play YouTube URL. Admin only.
router.post('/override', requireAuth, requireAdmin, playerLimiter, async (req, res) => {
  const url = validateYouTubeUrl(req.body.youtubeUrl, res);
  if (!url) return;

  const player = await resolveOrAutoJoinPlayer(req, res);
  if (!player) return;

  const metadata = await fetchYouTubeMetadata(url, res);
  if (!metadata) return;

  const { username: requestedBy, discordId: addedBy } = getRequestedBy(req);
  const queuedSong = buildQueuedSongFromMetadata(metadata, url, requestedBy, addedBy);

  await player.replaceQueueAndPlay([queuedSong]);

  res.json({
    message: `Now playing "${metadata.title}".`,
    song: queuedSong,
  });
});

export default router;

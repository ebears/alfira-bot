import { getClient } from '@alfira-bot/bot/src/lib/client';
import { createPlayer, getPlayer, removePlayer } from '@alfira-bot/bot/src/player/manager';
import { fisherYatesShuffle, type LoopMode } from '@alfira-bot/shared';
import {
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import type { TextChannel } from 'discord.js';
import type { Request, Response } from 'express';
import { Router } from 'express';
import prisma from '../lib/prisma';
import {
  buildQueuedSongFromMetadata,
  dbSongToQueuedSong,
  fetchPlaylistMetadata,
  fetchYouTubeMetadata,
  validateYouTubePlaylistUrl,
  validateYouTubeUrl,
} from '../lib/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { requireAdmin } from '../middleware/requireAdmin';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

const GUILD_ID = process.env.GUILD_ID as string;
if (!GUILD_ID) {
  throw new Error('GUILD_ID environment variable is not set');
}

/** Returns existing player or auto-joins the user's voice channel. */
async function resolveOrAutoJoinPlayer(
  req: Request,
  res: Response
): Promise<ReturnType<typeof getPlayer> | null> {
  const existingPlayer = getPlayer(GUILD_ID);
  if (existingPlayer) {
    return existingPlayer;
  }

  const discordClient = getClient();
  if (!discordClient) {
    res.status(503).json({ error: 'Discord bot is not ready yet.' });
    return null;
  }

  try {
    const guild = await discordClient.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(req.user?.discordId ?? '');
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      res.status(409).json({
        error: 'You are not in a voice channel. Join a voice channel in Discord first.',
      });
      return null;
    }

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: GUILD_ID,
      adapterCreator: guild.voiceAdapterCreator,
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 5_000);

    const textChannelId = process.env.DEFAULT_TEXT_CHANNEL_ID;
    const textChannel = textChannelId
      ? (guild.channels.cache.get(textChannelId) as TextChannel | undefined)
      : (guild.systemChannel as TextChannel | null);

    if (!textChannel) {
      res.status(503).json({
        error:
          'Could not find a text channel for "Now playing" messages. Set DEFAULT_TEXT_CHANNEL_ID in your environment.',
      });
      return null;
    }

    return createPlayer(GUILD_ID, connection, textChannel);
  } catch (error) {
    console.error('Failed to auto-join voice channel:', error);
    res.status(503).json({
      error: 'Could not connect to your voice channel. Try using /join in Discord first.',
    });
    return null;
  }
}

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
router.post(
  '/play',
  requireAuth,
  asyncHandler(async (req, res) => {
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

      if (playlist.isPrivate) {
        const isCreator = playlist.createdBy === req.user?.discordId;
        const isAdmin = req.user?.isAdmin;

        if (!isCreator && !isAdmin) {
          res.status(403).json({ error: 'Access denied. This playlist is private.' });
          return;
        }
      }

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

    const requestedBy = req.user?.username ?? 'Unknown';
    const queuedSongs = dbSongs.map((song) => dbSongToQueuedSong(song, requestedBy));

    if (startFromSongId) {
      await player.replaceQueueAndPlay(queuedSongs);
    } else {
      await player.addToQueue(queuedSongs);
    }

    res.json({ message: `Queued ${queuedSongs.length} song(s).` });
  })
);

// POST /api/player/skip — skip current song. Member accessible.
router.post(
  '/skip',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const player = getPlayer(GUILD_ID);

    if (!player || !player.getCurrentSong()) {
      res.status(409).json({ error: 'Nothing is currently playing.' });
      return;
    }

    await player.skip();
    res.json({ message: 'Skipped.' });
  })
);

// POST /api/player/leave — stop and disconnect. Member accessible.
router.post('/leave', requireAuth, (_req, res) => {
  const player = getPlayer(GUILD_ID);
  const connection = getVoiceConnection(GUILD_ID);

  if (!player && !connection) {
    res.status(409).json({ error: 'The bot is not in a voice channel.' });
    return;
  }

  if (player) player.stop();
  if (connection) connection.destroy();
  removePlayer(GUILD_ID);

  res.json({ message: 'Left the voice channel.' });
});

// POST /api/player/loop — set loop mode. Member accessible.
router.post('/loop', requireAuth, (req, res) => {
  const { mode } = req.body as { mode?: LoopMode };

  if (!mode || !['off', 'song', 'queue'].includes(mode)) {
    res.status(400).json({ error: 'mode must be "off", "song", or "queue".' });
    return;
  }

  const player = getPlayer(GUILD_ID);

  if (!player) {
    res.status(409).json({ error: 'Nothing is playing.' });
    return;
  }

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

// POST /api/player/quick-add — add YouTube URL to priority queue. Member accessible.
router.post(
  '/quick-add',
  requireAuth,
  asyncHandler(async (req, res) => {
    const url = validateYouTubeUrl(req.body.youtubeUrl, res);
    if (!url) return;

    const player = await resolveOrAutoJoinPlayer(req, res);
    if (!player) return;

    const metadata = await fetchYouTubeMetadata(url, res);
    if (!metadata) return;

    const requestedBy = req.user?.username ?? 'Unknown';
    const queuedSong = buildQueuedSongFromMetadata(
      metadata,
      url,
      requestedBy,
      req.user?.discordId ?? 'Unknown'
    );

    await player.addToPriorityQueue(queuedSong);

    res.json({
      message: `Added "${metadata.title}" to the queue.`,
      song: queuedSong,
    });
  })
);

// POST /api/player/quick-add-playlist — add playlist to queue. Member accessible.
router.post(
  '/quick-add-playlist',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { maxVideos } = req.body as { maxVideos?: number };
    const url = validateYouTubePlaylistUrl(req.body.youtubeUrl, res);
    if (!url) return;

    const player = await resolveOrAutoJoinPlayer(req, res);
    if (!player) return;

    const playlistMetadata = await fetchPlaylistMetadata(url, res, maxVideos);
    if (!playlistMetadata) return;

    const requestedBy = req.user?.username ?? 'Unknown';
    const queuedSongs = [];

    for (const video of playlistMetadata.videos) {
      const queuedSong = buildQueuedSongFromMetadata(
        {
          title: video.title,
          youtubeId: video.id,
          duration: video.duration,
          thumbnailUrl: video.thumbnailUrl,
        },
        `https://www.youtube.com/watch?v=${video.id}`,
        requestedBy,
        req.user?.discordId ?? 'Unknown'
      );

      await player.addToQueue(queuedSong);
      queuedSongs.push(queuedSong);
    }

    res.json({
      message: `Added ${queuedSongs.length} song(s) from "${playlistMetadata.title}" to the queue.`,
      playlistTitle: playlistMetadata.title,
      totalVideos: playlistMetadata.videoCount,
      queuedCount: queuedSongs.length,
      songs: queuedSongs,
    });
  })
);

// POST /api/player/pause-toggle — pause/resume. Member accessible.
router.post('/pause-toggle', requireAuth, (_req, res) => {
  const player = getPlayer(GUILD_ID);

  if (!player || !player.getCurrentSong()) {
    res.status(409).json({ error: 'Nothing is currently playing.' });
    return;
  }

  const isPaused = player.togglePause();
  res.json({ isPaused });
});

// POST /api/player/clear — clear queue. Admin only.
router.post('/clear', requireAuth, requireAdmin, (_req, res) => {
  const player = getPlayer(GUILD_ID);

  if (!player) {
    res.status(409).json({ error: 'Nothing is playing.' });
    return;
  }

  player.clearQueue();
  res.json({ message: 'Queue cleared.' });
});

// POST /api/player/add-to-priority — add library song to Up Next. Member accessible.
router.post(
  '/add-to-priority',
  requireAuth,
  asyncHandler(async (req, res) => {
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

    const requestedBy = req.user?.username ?? 'Unknown';
    const queuedSong = dbSongToQueuedSong(song, requestedBy);

    await player.addToPriorityQueue(queuedSong);

    res.json({
      message: `Added "${song.nickname || song.title}" to Up Next.`,
      song: queuedSong,
    });
  })
);

// POST /api/player/override — immediately play YouTube URL. Admin only.
router.post(
  '/override',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const url = validateYouTubeUrl(req.body.youtubeUrl, res);
    if (!url) return;

    const player = await resolveOrAutoJoinPlayer(req, res);
    if (!player) return;

    const metadata = await fetchYouTubeMetadata(url, res);
    if (!metadata) return;

    const requestedBy = req.user?.username ?? 'Unknown';
    const queuedSong = buildQueuedSongFromMetadata(
      metadata,
      url,
      requestedBy,
      req.user?.discordId ?? 'Unknown'
    );

    await player.replaceQueueAndPlay([queuedSong]);

    res.json({
      message: `Now playing "${metadata.title}".`,
      song: queuedSong,
    });
  })
);

export default router;

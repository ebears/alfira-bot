import { Router } from 'express';
import { getVoiceConnection, joinVoiceChannel, VoiceConnectionStatus, entersState } from '@discordjs/voice';
import { TextChannel } from 'discord.js';
import prisma from '../lib/prisma';
import { getClient } from '@discord-music-bot/bot/src/lib/client';
import { createPlayer } from '@discord-music-bot/bot/src/player/manager';
import { requireAuth } from '../middleware/requireAuth';
import { requireAdmin } from '../middleware/requireAdmin';
import { asyncHandler } from '../middleware/errorHandler';
import { getPlayer, removePlayer } from '@discord-music-bot/bot/src/player/manager';
import { isValidYouTubeUrl, getMetadata, isYouTubePlaylistUrl, getPlaylistMetadataWithVideos } from '@discord-music-bot/bot/src/utils/ytdlp';
import type { LoopMode, QueuedSong, Song } from '@discord-music-bot/shared';
import type { Request, Response } from 'express';

const router = Router();

const MAX_URL_LENGTH = 2000;

// ---------------------------------------------------------------------------
// Resolve the guild ID once at startup.
// The player is looked up by guild ID on every request. Since this is a
// single-server app, GUILD_ID is fixed and read from the environment.
// ---------------------------------------------------------------------------
const GUILD_ID = process.env.GUILD_ID!;

// ---------------------------------------------------------------------------
// Helper: Resolve existing player or auto-join the user's voice channel.
//
// This function checks if a player already exists for the guild. If not, it
// attempts to auto-join the requesting user's voice channel and create a new
// player. This eliminates duplicated auto-join logic across multiple routes.
//
// Returns:
//   - The player if it exists or was successfully created
//   - null if auto-join failed (response already sent)
// ---------------------------------------------------------------------------
async function resolveOrAutoJoinPlayer(
  req: Request,
  res: Response
): Promise<ReturnType<typeof getPlayer> | null> {
  const existingPlayer = getPlayer(GUILD_ID);
  if (existingPlayer) {
    return existingPlayer;
  }

  // Auto-join: Find the user's voice channel and join it.
  const discordClient = getClient();
  if (!discordClient) {
    res.status(503).json({ error: 'Discord bot is not ready yet.' });
    return null;
  }

  try {
    const guild = await discordClient.guilds.fetch(GUILD_ID);
    const member = await guild.members.fetch(req.user!.discordId);
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

    // Use DEFAULT_TEXT_CHANNEL_ID if set, otherwise fall back to system channel.
    const textChannelId = process.env.DEFAULT_TEXT_CHANNEL_ID;
    const textChannel = textChannelId
      ? (guild.channels.cache.get(textChannelId) as TextChannel | undefined)
      : (guild.systemChannel as TextChannel | null);

    if (!textChannel) {
      res.status(503).json({
        error: 'Could not find a text channel for "Now playing" messages. Set DEFAULT_TEXT_CHANNEL_ID in your environment.',
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

// ---------------------------------------------------------------------------
// GET /api/player/queue
//
// Returns the current queue state. Member accessible.
// If the bot is not in a voice channel, returns an empty state.
// ---------------------------------------------------------------------------
router.get(
  '/queue',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const player = getPlayer(GUILD_ID);

    if (!player) {
      res.json({
        isPlaying: false,
        isPaused: false,
        loopMode: 'off',
        currentSong: null,
        priorityQueue: [],
        queue: [],
        trackStartedAt: null,
      });
      return;
    }

    res.json(player.getQueueState());
  })
);

// ---------------------------------------------------------------------------
// POST /api/player/play
//
// Loads songs into the queue and starts playback.
// Member accessible.
//
// Body:
//   playlistId? — if provided, load songs from this playlist; otherwise
//                 load all songs from the library.
//   mode — "sequential" | "random"
//   loop — "off" | "song" | "queue"
//   startFromSongId? — if provided, start playback from this specific song
//                      (clears existing queue and interrupts current playback)
//
// Note: the bot must already be in a voice channel (via /join or /play in
// Discord) before this endpoint can work. The API cannot create a voice
// connection — only the bot can do that.
// ---------------------------------------------------------------------------
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
    if (!player) return; // Response already sent by helper

    // Fetch songs from the database.
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

      // Check access for private playlists
      if (playlist.isPrivate) {
        const isCreator = playlist.createdBy === req.user!.discordId;
        const isAdmin = req.user!.isAdmin;

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

    // If starting from a specific song, reorder so that song comes first
    if (startFromSongId) {
      const startIndex = dbSongs.findIndex((s) => s.id === startFromSongId);

      if (startIndex === -1) {
        res.status(404).json({ error: 'Start song not found in playlist.' });
        return;
      }

      // Reorder: chosen song first, then all songs after it, then songs before it
      dbSongs = [
        ...dbSongs.slice(startIndex),
        ...dbSongs.slice(0, startIndex),
      ];
    }

    // Apply shuffle if random mode is requested (after reordering for startFromSongId).
    if (mode === 'random') {
      for (let i = dbSongs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [dbSongs[i], dbSongs[j]] = [dbSongs[j], dbSongs[i]];
      }
    }

    // Preserve the current loop mode if not explicitly set
    const currentLoopMode = player.getLoopMode();
    const targetLoopMode = loop ?? currentLoopMode;

    // Set loop mode before adding songs so the first track picks it up.
    player.setLoopMode(targetLoopMode);

    // Build QueuedSong objects.
    // requestedBy shows who triggered playback in "Now playing" embeds.
    const requestedBy = req.user!.username;

    const queuedSongs: QueuedSong[] = dbSongs.map((song) => ({
      ...song,
      createdAt: song.createdAt.toISOString(),
      requestedBy,
    }));

    // If starting from a specific song, clear the queue and interrupt current playback
    if (startFromSongId) {
    await player.replaceQueueAndPlay(queuedSongs);
    } else {
    // Add songs to existing queue
    await player.addToQueue(queuedSongs);
    }

    res.json({ message: `Queued ${queuedSongs.length} song(s).` });
  })
);

// ---------------------------------------------------------------------------
// POST /api/player/skip
// Member accessible.
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// POST /api/player/leave
//
// Stops playback, clears the queue, and disconnects the bot from the voice
// channel. This is the web UI equivalent of the /leave slash command.
// Member accessible.
// ---------------------------------------------------------------------------
router.post(
  '/leave',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const player = getPlayer(GUILD_ID);
    const connection = getVoiceConnection(GUILD_ID);

    if (!player && !connection) {
      res.status(409).json({ error: 'The bot is not in a voice channel.' });
      return;
    }

    // Stop the player first (broadcasts idle state, kills FFmpeg process).
    if (player) {
      player.stop();
    }

    // Destroy the voice connection.
    if (connection) {
      connection.destroy();
    }

    // Belt-and-suspenders cleanup.
    removePlayer(GUILD_ID);

    res.json({ message: 'Left the voice channel.' });
  })
);



// ---------------------------------------------------------------------------
// POST /api/player/loop
// Member accessible.
// ---------------------------------------------------------------------------
router.post(
  '/loop',
  requireAuth,
  asyncHandler(async (req, res) => {
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
  })
);

// ---------------------------------------------------------------------------
// POST /api/player/shuffle
// Admin only.
// ---------------------------------------------------------------------------
router.post(
  '/shuffle',
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const player = getPlayer(GUILD_ID);

    if (!player || player.getQueue().length === 0) {
      res.status(409).json({ error: 'No songs in the queue to shuffle.' });
      return;
    }

    player.shuffle();

    res.json({ message: 'Queue shuffled.' });
  })
);

// ---------------------------------------------------------------------------
// POST /api/player/quick-add
//
// Adds a song to the queue without saving it to the library.
// Member accessible.
//
// Body:
//   youtubeUrl — YouTube URL to fetch and queue
// ---------------------------------------------------------------------------
router.post(
  '/quick-add',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { youtubeUrl } = req.body as { youtubeUrl?: string };

    if (!youtubeUrl || typeof youtubeUrl !== 'string') {
      res.status(400).json({ error: 'youtubeUrl is required.' });
      return;
    }

    const url = youtubeUrl.trim();

    if (url.length > MAX_URL_LENGTH) {
      res.status(400).json({ error: `URL must be ${MAX_URL_LENGTH} characters or less.` });
      return;
    }

    if (!isValidYouTubeUrl(url)) {
      res.status(400).json({ error: 'That does not look like a valid YouTube URL.' });
      return;
    }

    const player = await resolveOrAutoJoinPlayer(req, res);
    if (!player) return; // Response already sent by helper

    // Fetch metadata from YouTube
    let metadata;

    try {
      metadata = await getMetadata(url);
    } catch {
      res.status(422).json({
        error: 'Could not fetch video info. The video may be private, age-restricted, or unavailable.',
      });
      return;
    }

    // Create a QueuedSong without saving to database
    const requestedBy = req.user!.username;

    const queuedSong: QueuedSong = {
      id: `temp-${Date.now()}`,
      title: metadata.title,
      youtubeUrl: url,
      youtubeId: metadata.youtubeId,
      duration: metadata.duration,
      thumbnailUrl: metadata.thumbnailUrl,
      addedBy: req.user!.discordId,
      createdAt: new Date().toISOString(),
      requestedBy,
    };

    await player.addToPriorityQueue(queuedSong);

    res.json({
      message: `Added "${metadata.title}" to the queue.`,
      song: queuedSong,
    });
  })
);

// ---------------------------------------------------------------------------
// POST /api/player/quick-add-playlist
//
// Adds all songs from a YouTube playlist to the queue without saving to library.
// Member accessible.
//
// Body:
//   youtubeUrl — YouTube playlist URL to fetch and queue
//   maxVideos — Optional limit on number of videos to queue
// ---------------------------------------------------------------------------
router.post(
  '/quick-add-playlist',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { youtubeUrl, maxVideos } = req.body as { youtubeUrl?: string; maxVideos?: number };

    if (!youtubeUrl || typeof youtubeUrl !== 'string') {
      res.status(400).json({ error: 'youtubeUrl is required.' });
      return;
    }

    const url = youtubeUrl.trim();

    if (url.length > MAX_URL_LENGTH) {
      res.status(400).json({ error: `URL must be ${MAX_URL_LENGTH} characters or less.` });
      return;
    }

    if (!isYouTubePlaylistUrl(url)) {
      res.status(400).json({
        error: 'That does not look like a valid YouTube playlist URL. It should contain a "list" parameter.',
      });
      return;
    }

    const player = await resolveOrAutoJoinPlayer(req, res);
    if (!player) return; // Response already sent by helper

    // Fetch playlist metadata with videos
    let playlistMetadata;

    try {
      playlistMetadata = await getPlaylistMetadataWithVideos(url, maxVideos);
    } catch {
      res.status(422).json({
        error: 'Could not fetch playlist info. The playlist may be private or unavailable.',
      });
      return;
    }

    // Queue all songs from the playlist
    const requestedBy = req.user!.username;
    const queuedSongs: QueuedSong[] = [];

    for (const video of playlistMetadata.videos) {
      const queuedSong: QueuedSong = {
        id: `temp-${Date.now()}-${video.id}`,
        title: video.title,
        youtubeUrl: `https://www.youtube.com/watch?v=${video.id}`,
        youtubeId: video.id,
        duration: video.duration,
        thumbnailUrl: video.thumbnailUrl,
        addedBy: req.user!.discordId,
        createdAt: new Date().toISOString(),
        requestedBy,
      };

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

// ---------------------------------------------------------------------------
// POST /api/player/pause-toggle
// Member accessible.
// ---------------------------------------------------------------------------
router.post(
  '/pause-toggle',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const player = getPlayer(GUILD_ID);

    if (!player || !player.getCurrentSong()) {
      res.status(409).json({ error: 'Nothing is currently playing.' });
      return;
    }

    const isPaused = player.togglePause();

    res.json({ isPaused });
  })
);

// ---------------------------------------------------------------------------
// POST /api/player/clear
// Admin only.
// ---------------------------------------------------------------------------
router.post(
  '/clear',
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const player = getPlayer(GUILD_ID);

    if (!player) {
      res.status(409).json({ error: 'Nothing is playing.' });
      return;
    }

    player.clearQueue();

    res.json({ message: 'Queue cleared.' });
  })
);

// ---------------------------------------------------------------------------
// POST /api/player/resume
// Member accessible.
// ---------------------------------------------------------------------------
router.post(
  '/resume',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const player = getPlayer(GUILD_ID);

    if (!player) {
      res.status(409).json({ error: 'The bot is not in a voice channel.' });
      return;
    }

    await player.resume();

    res.json({ message: 'Resumed.' });
  })
);

// ---------------------------------------------------------------------------
// POST /api/player/add-to-priority
// Member accessible.
//
// Adds a song from the library to the priority queue (Up Next).
//
// Body:
//   songId — ID of the song from the library
// ---------------------------------------------------------------------------
router.post(
  '/add-to-priority',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { songId } = req.body as { songId?: string };

    if (!songId || typeof songId !== 'string') {
      res.status(400).json({ error: 'songId is required.' });
      return;
    }

    // Fetch the song from the database
    const song = await prisma.song.findUnique({
      where: { id: songId },
    });

    if (!song) {
      res.status(404).json({ error: 'Song not found.' });
      return;
    }

    const player = await resolveOrAutoJoinPlayer(req, res);
    if (!player) return; // Response already sent by helper

    // Create a QueuedSong from the database song
    const requestedBy = req.user!.username;

    const queuedSong: QueuedSong = {
      id: song.id,
      title: song.title,
      youtubeUrl: song.youtubeUrl,
      youtubeId: song.youtubeId,
      duration: song.duration,
      thumbnailUrl: song.thumbnailUrl,
      addedBy: song.addedBy,
      nickname: song.nickname,
      createdAt: song.createdAt.toISOString(),
      requestedBy,
    };

    await player.addToPriorityQueue(queuedSong);

    res.json({
      message: `Added "${song.nickname || song.title}" to Up Next.`,
      song: queuedSong,
    });
  })
);

// ---------------------------------------------------------------------------
// POST /api/player/override
// Admin only.
//
// Immediately stops current song, clears both queues, and plays the
// requested song. Does NOT save the song to the library.
//
// Body:
//   youtubeUrl — YouTube URL to fetch and play immediately
// ---------------------------------------------------------------------------
router.post(
  '/override',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { youtubeUrl } = req.body as { youtubeUrl?: string };

    if (!youtubeUrl || typeof youtubeUrl !== 'string') {
      res.status(400).json({ error: 'youtubeUrl is required.' });
      return;
    }

    const url = youtubeUrl.trim();

    if (url.length > MAX_URL_LENGTH) {
      res.status(400).json({ error: `URL must be ${MAX_URL_LENGTH} characters or less.` });
      return;
    }

    if (!isValidYouTubeUrl(url)) {
      res.status(400).json({ error: 'That does not look like a valid YouTube URL.' });
      return;
    }

    const player = await resolveOrAutoJoinPlayer(req, res);
    if (!player) return; // Response already sent by helper

    // Fetch metadata from YouTube
    let metadata;

    try {
      metadata = await getMetadata(url);
    } catch {
      res.status(422).json({
        error: 'Could not fetch video info. The video may be private, age-restricted, or unavailable.',
      });
      return;
    }

    // Create a QueuedSong without saving to database
    const requestedBy = req.user!.username;

    const queuedSong: QueuedSong = {
      id: `temp-${Date.now()}`,
      title: metadata.title,
      youtubeUrl: url,
      youtubeId: metadata.youtubeId,
      duration: metadata.duration,
      thumbnailUrl: metadata.thumbnailUrl,
      addedBy: req.user!.discordId,
      createdAt: new Date().toISOString(),
      requestedBy,
    };

    // Clear both queues and play immediately
    await player.replaceQueueAndPlay([queuedSong]);

    res.json({
      message: `Now playing "${metadata.title}".`,
      song: queuedSong,
    });
  })
);

export default router;

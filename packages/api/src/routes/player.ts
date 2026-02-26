import { Router } from 'express';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/requireAuth';
import { requireAdmin } from '../middleware/requireAdmin';
import { asyncHandler } from '../middleware/errorHandler';
import { getPlayer } from '@discord-music-bot/bot/src/player/manager';
import type { LoopMode, QueuedSong, Song } from '@discord-music-bot/shared';

const router = Router();

// ---------------------------------------------------------------------------
// Resolve the guild ID once at startup.
// The player is looked up by guild ID on every request. Since this is a
// single-server app, GUILD_ID is fixed and read from the environment.
// ---------------------------------------------------------------------------
const GUILD_ID = process.env.GUILD_ID!;

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
        loopMode: 'off',
        currentSong: null,
        queue: [],
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
// Admin only.
//
// Body:
//   playlistId? — if provided, load songs from this playlist; otherwise
//                 load all songs from the library.
//   mode        — "sequential" | "random"
//   loop        — "off" | "song" | "queue"
//
// Note: the bot must already be in a voice channel (via /join or /play in
// Discord) before this endpoint can work. The API cannot create a voice
// connection — only the bot can do that.
// ---------------------------------------------------------------------------
router.post(
  '/play',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { playlistId, mode, loop } = req.body as {
      playlistId?: string;
      mode?: 'sequential' | 'random';
      loop?: LoopMode;
    };

    const player = getPlayer(GUILD_ID);

    if (!player) {
      res.status(409).json({
        error: 'The bot is not in a voice channel. Use /join in Discord first.',
      });
      return;
    }

    // Fetch songs from the database.
    let dbSongs: Song[];
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

      dbSongs = playlist.songs.map((ps: { song: Song }): Song => ps.song);
    } else {
      dbSongs = await prisma.song.findMany({ orderBy: { createdAt: 'asc' } });
    }

    if (dbSongs.length === 0) {
      res.status(422).json({ error: 'No songs found to play.' });
      return;
    }

    // Apply shuffle if random mode is requested.
    if (mode === 'random') {
      for (let i = dbSongs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [dbSongs[i], dbSongs[j]] = [dbSongs[j], dbSongs[i]];
      }
    }

    // Set loop mode before adding songs so the first track picks it up.
    if (loop) {
      player.setLoopMode(loop);
    }

    // Build QueuedSong objects and enqueue them.
    // requestedBy shows who triggered playback in "Now playing" embeds.
    const requestedBy = req.user!.username;

    const queuedSongs: QueuedSong[] = dbSongs.map((song) => ({
      ...song,
      requestedBy,
    }));

    for (const song of queuedSongs) {
      await player.addToQueue(song);
    }

    res.json({ message: `Queued ${queuedSongs.length} song(s).` });
  })
);

// ---------------------------------------------------------------------------
// POST /api/player/skip
// Admin only.
// ---------------------------------------------------------------------------
router.post(
  '/skip',
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const player = getPlayer(GUILD_ID);

    if (!player || !player.isPlaying()) {
      res.status(409).json({ error: 'Nothing is currently playing.' });
      return;
    }

    await player.skip();
    res.json({ message: 'Skipped.' });
  })
);

// ---------------------------------------------------------------------------
// POST /api/player/stop
// Admin only.
// ---------------------------------------------------------------------------
router.post(
  '/stop',
  requireAuth,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const { removePlayer } = await import('@discord-music-bot/bot/src/player/manager');
    const player = getPlayer(GUILD_ID);

    if (!player) {
      res.status(409).json({ error: 'Nothing is playing.' });
      return;
    }

    player.stop();
    removePlayer(GUILD_ID);

    res.json({ message: 'Stopped.' });
  })
);

// ---------------------------------------------------------------------------
// POST /api/player/loop
// Admin only.
// ---------------------------------------------------------------------------
router.post(
  '/loop',
  requireAuth,
  requireAdmin,
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

export default router;

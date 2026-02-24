import { Router } from 'express';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/requireAuth';
import { requireAdmin } from '../middleware/requireAdmin';
import { asyncHandler } from '../middleware/errorHandler';
import { isValidYouTubeUrl, getMetadata } from '@discord-music-bot/bot/src/utils/ytdlp';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/songs
//
// Returns all songs, newest first. Accessible to any authenticated user.
// ---------------------------------------------------------------------------
router.get(
  '/',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const songs = await prisma.song.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(songs);
  })
);

// ---------------------------------------------------------------------------
// POST /api/songs
//
// Adds a new song by YouTube URL. Admin only.
//
// Flow:
//   1. Validate the URL format.
//   2. Check for duplicates by youtubeId.
//   3. Run yt-dlp to fetch metadata (title, duration, thumbnail).
//   4. Save to the database.
//
// Phase 8: emit a songs:added Socket.io event after saving.
// ---------------------------------------------------------------------------
router.post(
  '/',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { youtubeUrl } = req.body as { youtubeUrl?: string };

    if (!youtubeUrl || typeof youtubeUrl !== 'string') {
      res.status(400).json({ error: 'youtubeUrl is required.' });
      return;
    }

    const url = youtubeUrl.trim();

    if (!isValidYouTubeUrl(url)) {
      res.status(400).json({ error: 'That does not look like a valid YouTube URL.' });
      return;
    }

    // Fetch metadata first so we can extract the youtubeId for the duplicate check.
    let metadata;
    try {
      metadata = await getMetadata(url);
    } catch {
      res.status(422).json({
        error: 'Could not fetch video info. The video may be private, age-restricted, or unavailable.',
      });
      return;
    }

    // Check for duplicate by youtubeId (more reliable than URL comparison).
    const existing = await prisma.song.findUnique({
      where: { youtubeId: metadata.youtubeId },
    });

    if (existing) {
      res.status(409).json({
        error: 'This song is already in your library.',
        song: existing,
      });
      return;
    }

    const song = await prisma.song.create({
      data: {
        title: metadata.title,
        youtubeUrl: url,
        youtubeId: metadata.youtubeId,
        duration: metadata.duration,
        thumbnailUrl: metadata.thumbnailUrl,
        addedBy: req.user!.discordId,
      },
    });

    // TODO (Phase 8): emit songs:added event via Socket.io

    res.status(201).json(song);
  })
);

// ---------------------------------------------------------------------------
// DELETE /api/songs/:id
//
// Deletes a song and all its PlaylistSong associations (via cascade).
// Admin only.
//
// Phase 8: emit a songs:deleted event after deleting.
// ---------------------------------------------------------------------------
router.delete(
  '/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const existing = await prisma.song.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Song not found.' });
      return;
    }

    await prisma.song.delete({ where: { id } });

    // TODO (Phase 8): emit songs:deleted event via Socket.io

    res.status(204).send();
  })
);

export default router;

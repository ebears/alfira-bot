import { Router } from 'express';
import prisma from '../lib/prisma';
import { emitSongAdded, emitSongDeleted } from '../lib/socket';
import {
  fetchPlaylistMetadata,
  fetchYouTubeMetadata,
  validateYouTubePlaylistUrl,
  validateYouTubeUrl,
} from '../lib/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { requireAdmin } from '../middleware/requireAdmin';
import { requireAuth } from '../middleware/requireAuth';

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
// 1. Validate the URL format and length.
// 2. Fetch metadata via yt-dlp (title, duration, youtubeId).
// 3. Check for duplicates by youtubeId.
// 4. Save to the database.
// 5. Emit songs:added so all connected clients update in real time.
// ---------------------------------------------------------------------------
router.post(
  '/',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { nickname } = req.body as { nickname?: string };
    const trimmedNickname = nickname?.trim();
    if (trimmedNickname && trimmedNickname.length > 50) {
      res.status(400).json({ error: 'Nickname must be 50 characters or fewer.' });
      return;
    }
    const url = validateYouTubeUrl(req.body.youtubeUrl, res);
    if (!url) return;

    const metadata = await fetchYouTubeMetadata(url, res);
    if (!metadata) return;

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
        addedBy: req.user?.discordId ?? '',
        nickname: trimmedNickname || null,
      },
    });

    emitSongAdded(song);

    res.status(201).json(song);
  })
);

// ---------------------------------------------------------------------------
// POST /api/songs/import-playlist
//
// Imports all songs from a YouTube playlist into the library. Admin only.
//
// Flow:
// 1. Validate the URL is a YouTube playlist URL.
// 2. Fetch playlist metadata via yt-dlp (title, videos).
// 3. For each video, check for duplicates by youtubeId AND youtubeUrl.
// 4. Create songs in the database (batch insert).
// 5. Emit songs:added for each new song.
// ---------------------------------------------------------------------------
router.post(
  '/import-playlist',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { maxVideos } = req.body as { maxVideos?: number };
    const url = validateYouTubePlaylistUrl(req.body.youtubeUrl, res);
    if (!url) return;

    const playlistMetadata = await fetchPlaylistMetadata(url, res, maxVideos);
    if (!playlistMetadata) return;

    // Build the canonical URL format for each video
    const videosWithUrls = playlistMetadata.videos.map((v) => ({
      ...v,
      canonicalUrl: `https://www.youtube.com/watch?v=${v.id}`,
    }));

    // Get existing songs that match either by youtubeId OR youtubeUrl
    const existingSongs = await prisma.song.findMany({
      where: {
        OR: [
          { youtubeId: { in: videosWithUrls.map((v) => v.id) } },
          { youtubeUrl: { in: videosWithUrls.map((v) => v.canonicalUrl) } },
        ],
      },
      select: { youtubeId: true, youtubeUrl: true },
    });

    // Create sets for quick lookup
    const existingYoutubeIds = new Set(existingSongs.map((s) => s.youtubeId));
    const existingYoutubeUrls = new Set(existingSongs.map((s) => s.youtubeUrl));

    // Filter out duplicates (check both youtubeId and youtubeUrl)
    const newVideos = videosWithUrls.filter(
      (v) => !existingYoutubeIds.has(v.id) && !existingYoutubeUrls.has(v.canonicalUrl)
    );

    if (newVideos.length === 0) {
      res.status(200).json({
        message: 'All songs from this playlist are already in your library.',
        playlistTitle: playlistMetadata.title,
        totalVideos: playlistMetadata.videoCount,
        importedCount: 0,
        skippedCount: playlistMetadata.videos.length,
      });
      return;
    }

    // Create songs
    const createdSongs = await prisma.$transaction(
      newVideos.map((video) =>
        prisma.song.create({
          data: {
            title: video.title,
            youtubeUrl: video.canonicalUrl,
            youtubeId: video.id,
            duration: video.duration,
            thumbnailUrl: video.thumbnailUrl,
            addedBy: req.user?.discordId ?? '',
          },
        })
      )
    );

    // Emit socket events for each new song
    for (const song of createdSongs) {
      emitSongAdded(song);
    }

    res.status(201).json({
      message: `Successfully imported ${createdSongs.length} song(s) from "${playlistMetadata.title}".`,
      playlistTitle: playlistMetadata.title,
      totalVideos: playlistMetadata.videoCount,
      importedCount: createdSongs.length,
      skippedCount: playlistMetadata.videos.length - newVideos.length,
      songs: createdSongs,
    });
  })
);

// ---------------------------------------------------------------------------
// DELETE /api/songs/:id
//
// Deletes a song and all its PlaylistSong associations (via cascade).
// Admin only.
// ---------------------------------------------------------------------------
router.delete(
  '/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;

    const existing = await prisma.song.findUnique({ where: { id } });

    if (!existing) {
      res.status(404).json({ error: 'Song not found.' });
      return;
    }

    await prisma.song.delete({ where: { id } });

    // Notify all connected clients so the Songs page removes the card in real time.
    emitSongDeleted(id);

    res.status(204).send();
  })
);

export default router;

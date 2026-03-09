import {
  getMetadata,
  getPlaylistMetadataWithVideos,
  isValidYouTubeUrl,
  isYouTubePlaylistUrl,
} from '@discord-music-bot/bot/src/utils/ytdlp';
import { Router } from 'express';
import prisma from '../lib/prisma';
import { emitSongAdded, emitSongDeleted } from '../lib/socket';
import { asyncHandler } from '../middleware/errorHandler';
import { requireAdmin } from '../middleware/requireAdmin';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

const MAX_URL_LENGTH = 2000;

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
    const { youtubeUrl, nickname } = req.body as { youtubeUrl?: string; nickname?: string };

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

    // Fetch metadata first so we can extract the youtubeId for the duplicate check.
    let metadata: Awaited<ReturnType<typeof getMetadata>> | undefined;
    try {
      metadata = await getMetadata(url);
    } catch {
      res.status(422).json({
        error:
          'Could not fetch video info. The video may be private, age-restricted, or unavailable.',
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
        addedBy: req.user?.discordId,
        nickname: nickname?.trim() || null,
      },
    });

    // Notify all connected clients so the Songs page updates in real time.
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
        error:
          'That does not look like a valid YouTube playlist URL. It should contain a "list" parameter.',
      });
      return;
    }

    // Fetch playlist metadata with videos
    let playlistMetadata: Awaited<ReturnType<typeof getPlaylistMetadataWithVideos>> | undefined;
    try {
      playlistMetadata = await getPlaylistMetadataWithVideos(url, maxVideos);
    } catch {
      res.status(422).json({
        error: 'Could not fetch playlist info. The playlist may be private or unavailable.',
      });
      return;
    }

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
            addedBy: req.user?.discordId,
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

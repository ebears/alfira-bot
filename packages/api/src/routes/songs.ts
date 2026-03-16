import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getUserDisplayName } from '../lib/displayName';
import prisma from '../lib/prisma';
import { emitSongAdded, emitSongDeleted, emitSongUpdated } from '../lib/socket';
import {
  fetchPlaylistMetadata,
  fetchYouTubeMetadata,
  validateYouTubePlaylistUrl,
  validateYouTubeUrl,
} from '../lib/validation';
import { requireAdmin } from '../middleware/requireAdmin';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

// Rate limit playlist import to prevent abuse.
const importLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many imports. Please slow down.' },
});

function buildSongData(
  metadata: { title: string; youtubeId: string; duration: number; thumbnailUrl: string | null },
  youtubeUrl: string,
  addedBy: string
) {
  return {
    title: metadata.title,
    youtubeUrl,
    youtubeId: metadata.youtubeId,
    duration: metadata.duration,
    thumbnailUrl: metadata.thumbnailUrl as string,
    addedBy,
  };
}

// ---------------------------------------------------------------------------
// GET /api/songs
//
// Returns all songs, newest first. Accessible to any authenticated user.
// ---------------------------------------------------------------------------
router.get('/', requireAuth, async (_req, res) => {
  const songs = await prisma.song.findMany({
    orderBy: { createdAt: 'desc' },
  });

  // Resolve Discord display names for unique addedBy IDs
  const uniqueIds = [...new Set(songs.map((s) => s.addedBy))];
  const nameMap = new Map<string, string>();
  await Promise.all(
    uniqueIds.map(async (id) => {
      nameMap.set(id, await getUserDisplayName(id));
    })
  );

  const songsWithNames = songs.map((s) => ({
    ...s,
    addedByDisplayName: nameMap.get(s.addedBy) ?? s.addedBy,
  }));

  res.json(songsWithNames);
});

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
router.post('/', requireAuth, requireAdmin, async (req, res) => {
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
      ...buildSongData(metadata, url, req.user?.discordId ?? ''),
      nickname: trimmedNickname || null,
    },
  });

  emitSongAdded(song);

  res.status(201).json(song);
});

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
router.post('/import-playlist', requireAuth, requireAdmin, importLimiter, async (req, res) => {
  let { maxVideos } = req.body as { maxVideos?: number };
  if (maxVideos !== undefined) {
    maxVideos = Math.min(Math.max(1, maxVideos), 100);
  }
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
        data: buildSongData(
          {
            title: video.title,
            youtubeId: video.id,
            duration: video.duration,
            thumbnailUrl: video.thumbnailUrl,
          },
          video.canonicalUrl,
          req.user?.discordId ?? ''
        ),
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
});

// ---------------------------------------------------------------------------
// DELETE /api/songs/:id
//
// Deletes a song and all its PlaylistSong associations (via cascade).
// Admin only.
// ---------------------------------------------------------------------------
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
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
});

// ---------------------------------------------------------------------------
// PATCH /api/songs/:id
//
// Updates a song's nickname. Admin only.
// Clears the nickname by passing null or empty string.
// ---------------------------------------------------------------------------
router.patch('/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = req.params.id as string;
  const { nickname } = req.body as { nickname?: string | null };

  const trimmed = nickname?.trim() ?? null;
  if (trimmed && trimmed.length > 50) {
    res.status(400).json({ error: 'Nickname must be 50 characters or fewer.' });
    return;
  }

  const existing = await prisma.song.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Song not found.' });
    return;
  }

  const song = await prisma.song.update({
    where: { id },
    data: { nickname: trimmed || null },
  });

  emitSongUpdated(song);
  res.json(song);
});

export default router;

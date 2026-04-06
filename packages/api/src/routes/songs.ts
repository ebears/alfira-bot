import { tables } from '@alfira-bot/shared/db';
import { eq, sql } from 'drizzle-orm';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../lib/db';
import { getUserDisplayName } from '../lib/displayName';
import { emitSongAdded, emitSongDeleted, emitSongUpdated } from '../lib/socket';
import {
  clampMaxVideos,
  fetchPlaylistMetadata,
  fetchYouTubeMetadata,
  validateArtworkUrl,
  validateNickname,
  validateOptionalString,
  validateTags,
  validateVolumeOffset,
  validateYouTubePlaylistUrl,
  validateYouTubeUrl,
  youTubeUrl,
} from '../lib/validation';
import { requireAdmin } from '../middleware/requireAdmin';
import { requireAuth } from '../middleware/requireAuth';

const { song: songTable } = tables;

const router = Router();

// Rate limit playlist import to prevent abuse.
const importLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many imports. Please slow down.' },
});

// Helper: convert Drizzle row (with Date) to wire format (with string).
function formatSong(s: typeof songTable.$inferSelect) {
  return { ...s, createdAt: s.createdAt.toISOString(), tags: s.tags ?? [] };
}

// ---------------------------------------------------------------------------
// GET /api/songs
//
// Returns paginated songs, newest first. Accessible to any authenticated user.
// Query params: page (default 1), limit (default 30).
// ---------------------------------------------------------------------------
router.get('/', requireAuth, async (req, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '30'), 10) || 30));
  const skip = (page - 1) * limit;
  const search = String(req.query.search ?? '').trim();

  // Build tag-matching IDs via raw SQL (case-insensitive substring on array elements).
  const tagMatchingIds = search
    ? (
        await db.execute<{ id: string }>(
          sql`SELECT id FROM "Song" WHERE array_to_string(tags, ',') ILIKE ${`%${search}%`}`
        )
      ).map((r) => r.id)
    : [];

  const where = search
    ? tagMatchingIds.length > 0
      ? sql`(title ILIKE ${`%${search}%`} OR nickname ILIKE ${`%${search}%`} OR artist ILIKE ${`%${search}%`} OR album ILIKE ${`%${search}%`} OR id IN (${sql.join(
          tagMatchingIds.map((id) => sql.raw(`'${id}'`)),
          sql`,`
        )}))`
      : sql`(title ILIKE ${`%${search}%`} OR nickname ILIKE ${`%${search}%`} OR artist ILIKE ${`%${search}%`} OR album ILIKE ${`%${search}%`})`
    : undefined;

  const [songs, [{ count }]] = await Promise.all([
    db
      .select()
      .from(songTable)
      .where(where)
      .orderBy(sql`"createdAt" DESC`)
      .offset(skip)
      .limit(limit),
    db.select({ count: sql<number>`count(*)` }).from(songTable).where(where),
  ]);
  const total = parseInt(String(count), 10);

  // Resolve Discord display names for unique addedBy IDs
  const uniqueIds = [...new Set(songs.map((s) => s.addedBy))];
  const nameMap = new Map<string, string>();
  await Promise.all(
    uniqueIds.map(async (id) => {
      nameMap.set(id, await getUserDisplayName(id));
    })
  );

  const songsWithNames = songs.map((s) => ({
    ...formatSong(s),
    addedByDisplayName: nameMap.get(s.addedBy) ?? s.addedBy,
  }));

  res.json({
    items: songsWithNames,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// ---------------------------------------------------------------------------
// POST /api/songs
//
// Adds a new song by YouTube URL. Admin only.
// ---------------------------------------------------------------------------
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const trimmedNickname = validateNickname(req.body.nickname, res);
  if (trimmedNickname === false) return;

  const url = validateYouTubeUrl(req.body.youtubeUrl, res);
  if (!url) return;

  const metadata = await fetchYouTubeMetadata(url, res);
  if (!metadata) return;

  // Check for duplicate by youtubeId.
  const [existing] = await db
    .select()
    .from(songTable)
    .where(eq(songTable.youtubeId, metadata.youtubeId))
    .limit(1);

  if (existing) {
    res.status(409).json({
      error: 'This song is already in your library.',
      song: formatSong(existing),
    });
    return;
  }

  const [song] = await db
    .insert(songTable)
    .values({
      title: metadata.title,
      youtubeUrl: url,
      youtubeId: metadata.youtubeId,
      duration: metadata.duration,
      thumbnailUrl: metadata.thumbnailUrl ?? '',
      addedBy: req.user?.discordId ?? '',
      nickname: trimmedNickname,
    })
    .returning();

  const formatted = formatSong(song);
  emitSongAdded(formatted);

  res.status(201).json(formatted);
});

// ---------------------------------------------------------------------------
// POST /api/songs/import-playlist
//
// Imports all songs from a YouTube playlist into the library. Admin only.
// ---------------------------------------------------------------------------
router.post('/import-playlist', requireAuth, requireAdmin, importLimiter, async (req, res) => {
  const maxVideos = clampMaxVideos((req.body as { maxVideos?: number }).maxVideos);
  const url = validateYouTubePlaylistUrl(req.body.youtubeUrl, res);
  if (!url) return;

  const playlistMetadata = await fetchPlaylistMetadata(url, res, maxVideos);
  if (!playlistMetadata) return;

  // Build the canonical URL format for each video
  const videosWithUrls = playlistMetadata.videos.map((v) => ({
    ...v,
    canonicalUrl: youTubeUrl(v.id),
  }));

  let existingSongs: { youtubeId: string; youtubeUrl: string }[] = [];
  if (videosWithUrls.length > 0) {
    existingSongs = await db
      .select({ youtubeId: songTable.youtubeId, youtubeUrl: songTable.youtubeUrl })
      .from(songTable)
      .where(
        sql`"youtubeId" = ANY(ARRAY[${sql.join(
          videosWithUrls.map((v) => v.id),
          sql`,`
        )}]::text[]) OR "youtubeUrl" = ANY(ARRAY[${sql.join(
          videosWithUrls.map((v) => v.canonicalUrl),
          sql`,`
        )}]::text[])`
      );
  }

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

  // Create songs in a transaction
  const createdSongs = await db.transaction((tx) => {
    return tx
      .insert(songTable)
      .values(
        newVideos.map((video) => ({
          title: video.title,
          youtubeUrl: video.canonicalUrl,
          youtubeId: video.id,
          duration: video.duration,
          thumbnailUrl: video.thumbnailUrl ?? '',
          addedBy: req.user?.discordId ?? '',
        }))
      )
      .returning();
  });

  // Emit socket events for each new song
  for (const song of createdSongs) {
    emitSongAdded(formatSong(song));
  }

  res.status(201).json({
    message: `Successfully imported ${createdSongs.length} song(s) from "${playlistMetadata.title}".`,
    playlistTitle: playlistMetadata.title,
    totalVideos: playlistMetadata.videoCount,
    importedCount: createdSongs.length,
    skippedCount: playlistMetadata.videos.length - newVideos.length,
    songs: createdSongs.map(formatSong),
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

  const [existing] = await db.select().from(songTable).where(eq(songTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: 'Song not found.' });
    return;
  }

  await db.delete(songTable).where(eq(songTable.id, id));

  // Notify all connected clients so the Songs page removes the card in real time.
  emitSongDeleted(id);

  res.status(204).send();
});

// ---------------------------------------------------------------------------
// PATCH /api/songs/:id
//
// Updates a song's editable fields (nickname, artist, album, artwork, tags).
// Admin only. Only fields present in the request body are updated.
// ---------------------------------------------------------------------------
router.patch('/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = req.params.id as string;

  const [existing] = await db.select().from(songTable).where(eq(songTable.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: 'Song not found.' });
    return;
  }

  const data: Record<string, unknown> = {};

  // Nickname
  if ('nickname' in req.body) {
    const trimmed = validateNickname(req.body.nickname, res);
    if (trimmed === false) return;
    data.nickname = trimmed;
  }

  // Artist
  if ('artist' in req.body) {
    data.artist = validateOptionalString(req.body.artist);
  }

  // Album
  if ('album' in req.body) {
    data.album = validateOptionalString(req.body.album);
  }

  // Artwork
  if ('artwork' in req.body) {
    const artwork = validateArtworkUrl(req.body.artwork);
    if (artwork === false) {
      res.status(400).json({ error: 'artwork must be a valid URL.' });
      return;
    }
    data.artwork = artwork;
  }

  // Tags
  if ('tags' in req.body) {
    const tags = validateTags(req.body.tags);
    if (tags === false) {
      res.status(400).json({ error: 'tags must be an array of strings.' });
      return;
    }
    data.tags = tags;
  }

  // Volume offset
  if ('volumeOffset' in req.body) {
    const volumeOffset = validateVolumeOffset(req.body.volumeOffset);
    if (volumeOffset === false) {
      res.status(400).json({ error: 'volumeOffset must be an integer between -12 and +12.' });
      return;
    }
    data.volumeOffset = volumeOffset;
  }

  const [updatedSong] = await db
    .update(songTable)
    .set(data)
    .where(eq(songTable.id, id))
    .returning();

  emitSongUpdated(formatSong(updatedSong));
  res.json(formatSong(updatedSong));
});

export default router;

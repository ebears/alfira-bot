import { tables } from '@alfira-bot/shared/db';
import { eq, sql } from 'drizzle-orm';
import type { RouteContext } from '../index';
import { db } from '../lib/db';
import { getUserDisplayName } from '../lib/displayName';
import { json } from '../lib/json';

import { emitSongAdded, emitSongDeleted, emitSongUpdated, formatSong } from '../lib/socket';
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

const { song: songTable } = tables;

// ---------------------------------------------------------------------------
// GET /api/songs — paginated list of songs, newest first.
// ---------------------------------------------------------------------------
async function handleGetSongs(ctx: RouteContext, request: Request): Promise<Response> {
  if (!ctx.user) {
    return json({ error: 'Not authenticated. Please log in at /auth/login.' }, 401);
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get('limit') ?? '30', 10) || 30)
  );
  const skip = (page - 1) * limit;
  const search = url.searchParams.get('search')?.trim() ?? '';

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

  return json({
    items: songsWithNames,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

// ---------------------------------------------------------------------------
// POST /api/songs — add a song by YouTube URL. Admin only.
// ---------------------------------------------------------------------------
async function handlePostSong(ctx: RouteContext, request: Request): Promise<Response> {
  if (!ctx.user) {
    return json({ error: 'Not authenticated. Please log in at /auth/login.' }, 401);
  }
  if (!ctx.isAdmin) {
    return json({ error: 'Admin access required.' }, 403);
  }

  let body: { youtubeUrl?: unknown; nickname?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const nicknameResult = validateNickname(body.nickname);
  if (!nicknameResult.ok) return nicknameResult.response;

  const urlResult = validateYouTubeUrl(body.youtubeUrl);
  if (!urlResult.ok) return urlResult.response;
  const url = urlResult.value;

  const metadataResult = await fetchYouTubeMetadata(url);
  if (!metadataResult.ok) return metadataResult.response;
  const metadata = metadataResult.value;

  // Check for duplicate by youtubeId.
  const [existing] = await db
    .select()
    .from(songTable)
    .where(eq(songTable.youtubeId, metadata.youtubeId))
    .limit(1);

  if (existing) {
    return json(
      {
        error: 'This song is already in your library.',
        song: formatSong(existing),
      },
      409
    );
  }

  const [song] = await db
    .insert(songTable)
    .values({
      title: metadata.title,
      youtubeUrl: url,
      youtubeId: metadata.youtubeId,
      duration: metadata.duration,
      thumbnailUrl: metadata.thumbnailUrl ?? '',
      addedBy: ctx.user.discordId ?? '',
      nickname: nicknameResult.value,
    })
    .returning();

  const formatted = formatSong(song);
  emitSongAdded(formatted);

  return json(formatted, 201);
}

// ---------------------------------------------------------------------------
// POST /api/songs/import-playlist — import YouTube playlist. Admin only.
// ---------------------------------------------------------------------------
async function handleImportPlaylist(ctx: RouteContext, request: Request): Promise<Response> {
  if (!ctx.user) {
    return json({ error: 'Not authenticated. Please log in at /auth/login.' }, 401);
  }
  if (!ctx.isAdmin) {
    return json({ error: 'Admin access required.' }, 403);
  }

  let body: { youtubeUrl?: unknown; maxVideos?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const maxVideos = clampMaxVideos(body.maxVideos);
  const urlResult = validateYouTubePlaylistUrl(body.youtubeUrl);
  if (!urlResult.ok) return urlResult.response;
  const url = urlResult.value;

  const playlistResult = await fetchPlaylistMetadata(url, maxVideos);
  if (!playlistResult.ok) return playlistResult.response;
  const playlistMetadata = playlistResult.value;

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
    return json({
      message: 'All songs from this playlist are already in your library.',
      playlistTitle: playlistMetadata.title,
      totalVideos: playlistMetadata.videoCount,
      importedCount: 0,
      skippedCount: playlistMetadata.videos.length,
    });
  }

  // Capture discordId before transaction to avoid TypeScript narrowing issues in callbacks
  const addedByDiscordId = ctx.user?.discordId ?? '';

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
          addedBy: addedByDiscordId,
        }))
      )
      .returning();
  });

  // Emit socket events for each new song
  for (const song of createdSongs) {
    emitSongAdded(formatSong(song));
  }

  return json(
    {
      message: `Successfully imported ${createdSongs.length} song(s) from "${playlistMetadata.title}".`,
      playlistTitle: playlistMetadata.title,
      totalVideos: playlistMetadata.videoCount,
      importedCount: createdSongs.length,
      skippedCount: playlistMetadata.videos.length - newVideos.length,
      songs: createdSongs.map(formatSong),
    },
    201
  );
}

// ---------------------------------------------------------------------------
// DELETE /api/songs/:id — delete a song. Admin only.
// ---------------------------------------------------------------------------
async function handleDeleteSong(
  ctx: RouteContext,
  _request: Request,
  id: string
): Promise<Response> {
  if (!ctx.user) {
    return json({ error: 'Not authenticated. Please log in at /auth/login.' }, 401);
  }
  if (!ctx.isAdmin) {
    return json({ error: 'Admin access required.' }, 403);
  }

  const [existing] = await db.select().from(songTable).where(eq(songTable.id, id)).limit(1);
  if (!existing) {
    return json({ error: 'Song not found.' }, 404);
  }

  await db.delete(songTable).where(eq(songTable.id, id));

  // Notify all connected clients so the Songs page removes the card in real time.
  emitSongDeleted(id);

  return new Response(null, { status: 204 });
}

// ---------------------------------------------------------------------------
// PATCH /api/songs/:id — update song fields. Admin only.
// ---------------------------------------------------------------------------
async function handlePatchSong(ctx: RouteContext, request: Request, id: string): Promise<Response> {
  if (!ctx.user) {
    return json({ error: 'Not authenticated. Please log in at /auth/login.' }, 401);
  }
  if (!ctx.isAdmin) {
    return json({ error: 'Admin access required.' }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const [existing] = await db.select().from(songTable).where(eq(songTable.id, id)).limit(1);
  if (!existing) {
    return json({ error: 'Song not found.' }, 404);
  }

  const data: Record<string, unknown> = {};

  // Nickname
  if ('nickname' in body) {
    const result = validateNickname(body.nickname);
    if (!result.ok) return result.response;
    data.nickname = result.value;
  }

  // Artist
  if ('artist' in body) {
    data.artist = validateOptionalString(body.artist);
  }

  // Album
  if ('album' in body) {
    data.album = validateOptionalString(body.album);
  }

  // Artwork
  if ('artwork' in body) {
    const artworkResult = validateArtworkUrl(body.artwork);
    if (!artworkResult.ok) return artworkResult.response;
    data.artwork = artworkResult.value;
  }

  // Tags
  if ('tags' in body) {
    const tagsResult = validateTags(body.tags);
    if (!tagsResult.ok) return tagsResult.response;
    data.tags = tagsResult.value;
  }

  // Volume offset
  if ('volumeOffset' in body) {
    const volumeResult = validateVolumeOffset(body.volumeOffset);
    if (!volumeResult.ok) return volumeResult.response;
    data.volumeOffset = volumeResult.value;
  }

  const [updatedSong] = await db
    .update(songTable)
    .set(data)
    .where(eq(songTable.id, id))
    .returning();

  emitSongUpdated(formatSong(updatedSong));
  return json(formatSong(updatedSong));
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export async function handleSongs(ctx: RouteContext, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // POST /api/songs/import-playlist
  if (request.method === 'POST' && pathname === '/api/songs/import-playlist') {
    return await handleImportPlaylist(ctx, request);
  }

  // GET /api/songs
  if (request.method === 'GET' && pathname === '/api/songs') {
    return await handleGetSongs(ctx, request);
  }

  // POST /api/songs
  if (request.method === 'POST' && pathname === '/api/songs') {
    return await handlePostSong(ctx, request);
  }

  // DELETE /api/songs/:id
  if (request.method === 'DELETE' && pathname.startsWith('/api/songs/')) {
    const id = pathname.slice('/api/songs/'.length);
    return await handleDeleteSong(ctx, request, id);
  }

  // PATCH /api/songs/:id
  if (request.method === 'PATCH' && pathname.startsWith('/api/songs/')) {
    const id = pathname.slice('/api/songs/'.length);
    return await handlePatchSong(ctx, request, id);
  }

  return json({ error: 'Not Found' }, 404);
}

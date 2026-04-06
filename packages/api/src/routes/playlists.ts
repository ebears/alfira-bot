import { tables } from '@alfira-bot/shared/db';
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import type { Response } from 'express';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from '../lib/db';
import { getUserDisplayName } from '../lib/displayName';
import { canAccessPlaylist, type UserContext } from '../lib/playlistAccess';
import { emitPlaylistUpdated } from '../lib/socket';
import { validatePlaylistName } from '../lib/validation';
import { requireAuth } from '../middleware/requireAuth';

const { playlist: playlistTable, playlistSong: playlistSongTable } = tables;

const router = Router();

// Rate limit playlist mutations to prevent abuse.
const playlistLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

type PlaylistRow = {
  id: string;
  name: string;
  createdBy: string;
  isPrivate: boolean;
  createdAt: Date;
  _count?: { songs: number };
};

async function findPlaylistOr404(
  id: string,
  res: Response,
  withCount = false
): Promise<PlaylistRow | null> {
  const [row] = await db
    .select({
      id: playlistTable.id,
      name: playlistTable.name,
      createdBy: playlistTable.createdBy,
      isPrivate: playlistTable.isPrivate,
      createdAt: playlistTable.createdAt,
    })
    .from(playlistTable)
    .where(eq(playlistTable.id, id))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: 'Playlist not found.' });
    return null;
  }
  if (withCount) {
    const [{ value }] = await db
      .select({ value: count() })
      .from(playlistSongTable)
      .where(eq(playlistSongTable.playlistId, id));
    return {
      ...row,
      _count: { songs: value },
    };
  }
  return row;
}

/** Finds a playlist by ID and checks owner/admin access. Sends 404 or 403 and returns null if access denied. */
async function requirePlaylistAccess(
  id: string,
  user: UserContext | undefined,
  res: Response,
  action: string,
  withCount = false
) {
  const playlist = await findPlaylistOr404(id, res, withCount);
  if (!playlist) return null;
  if (!canAccessPlaylist(playlist, user, undefined, true)) {
    res.status(403).json({ error: `Only the playlist owner or admins can ${action}.` });
    return null;
  }
  return playlist;
}

function formatPlaylist(pl: typeof playlistTable.$inferSelect, songCount?: number) {
  const result: {
    id: string;
    name: string;
    createdBy: string;
    isPrivate: boolean;
    createdAt: string;
    _count?: { songs: number };
  } = {
    ...pl,
    createdAt: pl.createdAt.toISOString(),
  };
  if (songCount !== undefined) {
    result._count = { songs: songCount };
  }
  return result;
}

function formatPlaylistSongWithSong(
  ps: typeof playlistSongTable.$inferSelect,
  song: typeof tables.song.$inferSelect
) {
  return {
    ...ps,
    song: { ...song, createdAt: song.createdAt.toISOString(), tags: song.tags ?? [] },
  };
}

// ---------------------------------------------------------------------------
// GET /api/playlists
//
// Returns paginated playlists with a count of songs in each. Member accessible.
// Query params: page (default 1), limit (default 30), adminView (default false).
// ---------------------------------------------------------------------------
router.get('/', requireAuth, async (req, res) => {
  const adminView = req.query.adminView === 'true';
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '30'), 10) || 30));
  const skip = (page - 1) * limit;

  const [playlists, [{ count: total }]] = await Promise.all([
    db.select().from(playlistTable).orderBy(playlistTable.createdAt).limit(limit).offset(skip),
    db.select({ count: count() }).from(playlistTable),
  ]);

  // Fetch song counts for each playlist
  const playlistsWithCounts = await Promise.all(
    playlists.map(async (pl) => {
      const [{ value }] = await db
        .select({ value: count() })
        .from(playlistSongTable)
        .where(eq(playlistSongTable.playlistId, pl.id));
      return formatPlaylist(pl, value);
    })
  );

  // Filter private playlists: only visible to creator and admins (in Admin View)
  const filteredPlaylists = playlistsWithCounts.filter((pl) =>
    canAccessPlaylist(pl, req.user, undefined, adminView)
  );

  // Fetch creator display names for each playlist
  const playlistsWithCreator = await Promise.all(
    filteredPlaylists.map(async (pl) => ({
      ...pl,
      createdByDisplayName: await getUserDisplayName(pl.createdBy),
    }))
  );

  res.json({
    items: playlistsWithCreator,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// ---------------------------------------------------------------------------
// POST /api/playlists
//
// Creates a new empty playlist. All authenticated users can create playlists.
// ---------------------------------------------------------------------------
router.post('/', requireAuth, playlistLimiter, async (req, res) => {
  const { name } = req.body as { name?: string };
  const trimmedName = validatePlaylistName(name, res);
  if (!trimmedName) return;

  const [playlist] = await db
    .insert(playlistTable)
    .values({
      name: trimmedName,
      createdBy: req.user?.discordId ?? '',
    })
    .returning();

  emitPlaylistUpdated(formatPlaylist(playlist, 0));
  res.status(201).json(playlist);
});

// ---------------------------------------------------------------------------
// GET /api/playlists/:id
//
// Returns a single playlist with paginated songs. Member accessible.
// Query params: page (default 1), limit (default 30), adminView (default false).
// ---------------------------------------------------------------------------
router.get('/:id', requireAuth, async (req, res) => {
  const adminView = req.query.adminView === 'true';
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '30'), 10) || 30));
  const skip = (page - 1) * limit;

  const id = req.params.id as string;

  // Fetch playlist metadata and total song count
  const playlist = await findPlaylistOr404(id, res, true);
  if (!playlist) return;

  if (!canAccessPlaylist(playlist, req.user, res, adminView)) return;

  // Fetch paginated songs
  const [playlistSongs, [{ count: total }]] = await Promise.all([
    db
      .select()
      .from(playlistSongTable)
      .where(eq(playlistSongTable.playlistId, id))
      .orderBy(playlistSongTable.position)
      .limit(limit)
      .offset(skip),
    db
      .select({ count: count() })
      .from(playlistSongTable)
      .where(eq(playlistSongTable.playlistId, id)),
  ]);

  // Fetch the actual song data for each playlist entry
  const songIds = playlistSongs.map((ps) => ps.songId);
  const songs =
    songIds.length > 0
      ? await db.select().from(tables.song).where(inArray(tables.song.id, songIds))
      : [];
  const songMap = new Map<string, typeof tables.song.$inferSelect>();
  for (const s of songs) {
    songMap.set(s.id, s);
  }

  res.json({
    ...playlist,
    createdAt:
      playlist.createdAt instanceof Date
        ? playlist.createdAt.toISOString()
        : playlist.createdAt,
    songs: playlistSongs
      .map((ps) => {
        const song = songMap.get(ps.songId);
        return song ? formatPlaylistSongWithSong(ps, song) : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
    createdByDisplayName: await getUserDisplayName(playlist.createdBy),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/playlists/:id/visibility
//
// Toggles playlist visibility (public/private).
// Creator always, admins in Admin View.
// ---------------------------------------------------------------------------
router.patch('/:id/visibility', requireAuth, async (req, res) => {
  const { isPrivate, adminView } = req.body as { isPrivate?: boolean; adminView?: boolean };
  if (typeof isPrivate !== 'boolean') {
    res.status(400).json({ error: 'isPrivate (boolean) is required.' });
    return;
  }

  const existing = await findPlaylistOr404(req.params.id as string, res);
  if (!existing) return;

  // Check permissions: creator or admin (in Admin View)
  if (!canAccessPlaylist(existing, req.user, res, adminView)) return;

  const [updatedPlaylist] = await db
    .update(playlistTable)
    .set({ isPrivate })
    .where(eq(playlistTable.id, req.params.id as string))
    .returning();

  const [{ value }] = await db
    .select({ value: count() })
    .from(playlistSongTable)
    .where(eq(playlistSongTable.playlistId, updatedPlaylist.id));
  emitPlaylistUpdated(formatPlaylist(updatedPlaylist, value));
  res.json(updatedPlaylist);
});

// ---------------------------------------------------------------------------
// PATCH /api/playlists/:id
//
// Renames a playlist. Playlist owner or admin.
// ---------------------------------------------------------------------------
router.patch('/:id', requireAuth, async (req, res) => {
  const { name } = req.body as { name?: string };
  const trimmedName = validatePlaylistName(name, res);
  if (!trimmedName) return;

  const id = req.params.id as string;

  const existing = await requirePlaylistAccess(id, req.user, res, 'rename this playlist');
  if (!existing) return;

  const [updatedPlaylist] = await db
    .update(playlistTable)
    .set({ name: trimmedName })
    .where(eq(playlistTable.id, id))
    .returning();

  const [{ value }] = await db
    .select({ value: count() })
    .from(playlistSongTable)
    .where(eq(playlistSongTable.playlistId, updatedPlaylist.id));
  emitPlaylistUpdated(formatPlaylist(updatedPlaylist, value));
  res.json(updatedPlaylist);
});

// ---------------------------------------------------------------------------
// DELETE /api/playlists/:id
//
// Deletes a playlist. Songs in the library are NOT deleted — only the
// PlaylistSong associations are removed (via cascade). Playlist owner or admin.
// ---------------------------------------------------------------------------
router.delete('/:id', requireAuth, async (req, res) => {
  const id = req.params.id as string;

  const existing = await requirePlaylistAccess(id, req.user, res, 'delete this playlist');
  if (!existing) return;

  await db.delete(playlistTable).where(eq(playlistTable.id, id));

  res.status(204).send();
});

// ---------------------------------------------------------------------------
// POST /api/playlists/:id/songs
//
// Adds a song to a playlist. The song must already exist in the library.
// It is appended at the end (highest existing position + 1). Playlist owner or admin.
// ---------------------------------------------------------------------------
router.post('/:id/songs', requireAuth, playlistLimiter, async (req, res) => {
  const { songId } = req.body as { songId?: string };

  if (!songId) {
    res.status(400).json({ error: 'songId is required.' });
    return;
  }

  const id = req.params.id as string;

  const playlist = await requirePlaylistAccess(id, req.user, res, 'add songs to this playlist');
  if (!playlist) return;

  const [song] = await db.select().from(tables.song).where(eq(tables.song.id, songId)).limit(1);
  if (!song) {
    res.status(404).json({ error: 'Song not found.' });
    return;
  }

  // Check for duplicate.
  const [existing] = await db
    .select()
    .from(playlistSongTable)
    .where(
      and(
        eq(playlistSongTable.playlistId, playlist.id as string),
        eq(playlistSongTable.songId, song.id)
      )
    )
    .limit(1);

  if (existing) {
    res.status(409).json({ error: 'This song is already in the playlist.' });
    return;
  }

  // Find the current highest position so we can append.
  const [lastEntry] = await db
    .select()
    .from(playlistSongTable)
    .where(eq(playlistSongTable.playlistId, playlist.id as string))
    .orderBy(desc(playlistSongTable.position))
    .limit(1);

  const nextPosition = (lastEntry?.position ?? -1) + 1;

  const [ps] = await db
    .insert(playlistSongTable)
    .values({
      playlistId: playlist.id as string,
      songId: song.id,
      position: nextPosition,
    })
    .returning();

  const songData = { ...song, createdAt: song.createdAt.toISOString(), tags: song.tags ?? [] };
  const [countRow] = await db
    .select({ value: count() })
    .from(playlistSongTable)
    .where(eq(playlistSongTable.playlistId, playlist.id as string));
  emitPlaylistUpdated(formatPlaylist(playlist, countRow.value));

  res.status(201).json({
    ...ps,
    song: songData,
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/playlists/:id/songs/:songId
//
// Removes a song from a playlist. Does not delete the song from the library.
// Playlist owner or admin.
// ---------------------------------------------------------------------------
router.delete('/:id/songs/:songId', requireAuth, playlistLimiter, async (req, res) => {
  const { id: playlistId, songId } = req.params;
  const pid = playlistId as string;
  const sid = songId as string;

  // Fetch the playlist and check ownership
  const playlist = await requirePlaylistAccess(pid, req.user, res, 'remove songs');
  if (!playlist) return;

  const [entry] = await db
    .select()
    .from(playlistSongTable)
    .where(and(eq(playlistSongTable.playlistId, pid), eq(playlistSongTable.songId, sid)))
    .limit(1);

  if (!entry) {
    res.status(404).json({ error: 'Song not found in playlist.' });
    return;
  }

  // Delete and re-index in a transaction to prevent inconsistent positions.
  await db.transaction(async (tx) => {
    await tx
      .delete(playlistSongTable)
      .where(and(eq(playlistSongTable.playlistId, pid), eq(playlistSongTable.songId, sid)));

    // Re-index remaining songs to close the gap in positions.
    const remaining = await tx
      .select()
      .from(playlistSongTable)
      .where(eq(playlistSongTable.playlistId, pid))
      .orderBy(playlistSongTable.position);

    await Promise.all(
      remaining.map((ps, index) =>
        tx.update(playlistSongTable).set({ position: index }).where(eq(playlistSongTable.id, ps.id))
      )
    );
  });

  const [{ value }] = await db
    .select({ value: count() })
    .from(playlistSongTable)
    .where(eq(playlistSongTable.playlistId, pid));
  const updatedPlaylist = formatPlaylist(playlist, value);
  emitPlaylistUpdated(updatedPlaylist);

  res.status(204).send();
});

export default router;

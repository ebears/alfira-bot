import { getClient } from '@alfira-bot/bot/src/lib/client';
import type { Response } from 'express';
import { Router } from 'express';
import { canAccessPlaylist, type PlaylistLike, type UserContext } from '../lib/playlistAccess';
import prisma from '../lib/prisma';
import { emitPlaylistUpdated } from '../lib/socket';
import { asyncHandler } from '../middleware/errorHandler';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();
const MAX_NAME_LENGTH = 200;

const PLAYLIST_WITH_COUNT = { _count: { select: { songs: true } } };

function validatePlaylistName(name: unknown, res: Response): string | null {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'name is required.' });
    return null;
  }
  if (name.length > MAX_NAME_LENGTH) {
    res.status(400).json({ error: `name must be ${MAX_NAME_LENGTH} characters or less.` });
    return null;
  }
  return name.trim();
}

async function findPlaylistOr404(id: string, res: Response, include?: Record<string, unknown>) {
  const playlist = await prisma.playlist.findUnique({
    where: { id },
    ...(include ? { include } : {}),
  });
  if (!playlist) {
    res.status(404).json({ error: 'Playlist not found.' });
    return null;
  }
  return playlist;
}

/** Returns true if user is owner or admin. Sends 403 and returns false if not. */
function requirePlaylistOwnerOrAdmin(
  playlist: PlaylistLike,
  user: UserContext | undefined,
  res: Response,
  action: string
): boolean {
  if (playlist.createdBy === user?.discordId || user?.isAdmin) return true;
  res.status(403).json({ error: `Only the playlist owner or admins can ${action}.` });
  return false;
}

/**
 * Finds a playlist by ID and checks owner/admin access.
 * Sends 404 or 403 and returns null if access is denied.
 */
async function requirePlaylistAccess(
  id: string,
  user: UserContext | undefined,
  res: Response,
  action: string,
  include?: Record<string, unknown>
) {
  const playlist = await findPlaylistOr404(id, res, include);
  if (!playlist) return null;
  if (!requirePlaylistOwnerOrAdmin(playlist, user, res, action)) return null;
  return playlist;
}

async function getUserDisplayName(discordId: string): Promise<string> {
  const client = getClient();
  if (!client) return discordId;

  try {
    const guildId = process.env.GUILD_ID;
    if (!guildId) return discordId;
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(discordId);
    return member.displayName || member.user.username || discordId;
  } catch {
    return discordId;
  }
}

async function emitPlaylistBroadcast(playlistId: string): Promise<void> {
  const updatedPlaylist = await prisma.playlist.findUnique({
    where: { id: playlistId },
    include: PLAYLIST_WITH_COUNT,
  });
  if (updatedPlaylist) emitPlaylistUpdated(updatedPlaylist);
}

// ---------------------------------------------------------------------------
// GET /api/playlists
//
// Returns all playlists with a count of songs in each. Member accessible.
// ---------------------------------------------------------------------------
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const adminView = req.query.adminView === 'true';
    const playlists = await prisma.playlist.findMany({
      orderBy: { createdAt: 'asc' },
      include: PLAYLIST_WITH_COUNT,
    });

    // Filter private playlists: only visible to creator and admins (in Admin View)
    const filteredPlaylists = playlists.filter((pl) =>
      canAccessPlaylist(pl, req.user, undefined, adminView)
    );

    // Fetch creator display names for each playlist
    const playlistsWithCreator = await Promise.all(
      filteredPlaylists.map(async (pl) => ({
        ...pl,
        createdByDisplayName: await getUserDisplayName(pl.createdBy),
      }))
    );

    res.json(playlistsWithCreator);
  })
);

// ---------------------------------------------------------------------------
// POST /api/playlists
//
// Creates a new empty playlist. All authenticated users can create playlists.
// ---------------------------------------------------------------------------
router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { name } = req.body as { name?: string };
    const trimmedName = validatePlaylistName(name, res);
    if (!trimmedName) return;

    const playlist = await prisma.playlist.create({
      data: {
        name: trimmedName,
        createdBy: req.user?.discordId ?? '',
      },
    });

    emitPlaylistUpdated({ ...playlist, _count: { songs: 0 } });
    res.status(201).json(playlist);
  })
);

// ---------------------------------------------------------------------------
// GET /api/playlists/:id
//
// Returns a single playlist with its songs in position order. Member accessible.
// ---------------------------------------------------------------------------
router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const adminView = req.query.adminView === 'true';
    const playlist = await findPlaylistOr404(req.params.id as string, res, {
      songs: {
        orderBy: { position: 'asc' },
        include: { song: true },
      },
    });
    if (!playlist) return;

    if (!canAccessPlaylist(playlist, req.user, res, adminView)) return;

    res.json({
      ...playlist,
      createdByDisplayName: await getUserDisplayName(playlist.createdBy),
    });
  })
);

// ---------------------------------------------------------------------------
// PATCH /api/playlists/:id/visibility
//
// Toggles playlist visibility (public/private).
// Creator always, admins in Admin View.
// ---------------------------------------------------------------------------
router.patch(
  '/:id/visibility',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { isPrivate, adminView } = req.body as { isPrivate?: boolean; adminView?: boolean };
    if (typeof isPrivate !== 'boolean') {
      res.status(400).json({ error: 'isPrivate (boolean) is required.' });
      return;
    }

    const existing = await findPlaylistOr404(req.params.id as string, res);
    if (!existing) return;

    // Check permissions: creator or admin (in Admin View)
    if (!canAccessPlaylist(existing, req.user, res, adminView)) return;

    const playlist = await prisma.playlist.update({
      where: { id: req.params.id as string },
      data: { isPrivate },
      include: PLAYLIST_WITH_COUNT,
    });

    emitPlaylistUpdated(playlist);
    res.json(playlist);
  })
);

// ---------------------------------------------------------------------------
// PATCH /api/playlists/:id
//
// Renames a playlist. Playlist owner or admin.
// ---------------------------------------------------------------------------
router.patch(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { name } = req.body as { name?: string };
    const trimmedName = validatePlaylistName(name, res);
    if (!trimmedName) return;

    const id = req.params.id as string;

    const existing = await requirePlaylistAccess(id, req.user, res, 'rename this playlist');
    if (!existing) return;

    const playlist = await prisma.playlist.update({
      where: { id },
      data: { name: trimmedName },
      include: PLAYLIST_WITH_COUNT,
    });

    emitPlaylistUpdated(playlist);
    res.json(playlist);
  })
);

// ---------------------------------------------------------------------------
// DELETE /api/playlists/:id
//
// Deletes a playlist. Songs in the library are NOT deleted — only the
// PlaylistSong associations are removed (via cascade). Playlist owner or admin.
// ---------------------------------------------------------------------------
router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;

    const existing = await requirePlaylistAccess(id, req.user, res, 'delete this playlist');
    if (!existing) return;

    await prisma.playlist.delete({ where: { id } });

    res.status(204).send();
  })
);

// ---------------------------------------------------------------------------
// POST /api/playlists/:id/songs
//
// Adds a song to a playlist. The song must already exist in the library.
// It is appended at the end (highest existing position + 1). Playlist owner or admin.
// ---------------------------------------------------------------------------
router.post(
  '/:id/songs',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { songId } = req.body as { songId?: string };

    if (!songId) {
      res.status(400).json({ error: 'songId is required.' });
      return;
    }

    const id = req.params.id as string;

    const playlist = await requirePlaylistAccess(id, req.user, res, 'add songs to this playlist');
    if (!playlist) return;

    const song = await prisma.song.findUnique({ where: { id: songId } });
    if (!song) {
      res.status(404).json({ error: 'Song not found.' });
      return;
    }

    // Check for duplicate.
    const existing = await prisma.playlistSong.findUnique({
      where: {
        playlistId_songId: { playlistId: playlist.id, songId: song.id },
      },
    });

    if (existing) {
      res.status(409).json({ error: 'This song is already in the playlist.' });
      return;
    }

    // Find the current highest position so we can append.
    const lastEntry = await prisma.playlistSong.findFirst({
      where: { playlistId: playlist.id },
      orderBy: { position: 'desc' },
    });

    const nextPosition = (lastEntry?.position ?? -1) + 1;

    const playlistSong = await prisma.playlistSong.create({
      data: {
        playlistId: playlist.id,
        songId: song.id,
        position: nextPosition,
      },
      include: { song: true },
    });

    await emitPlaylistBroadcast(playlist.id);
    res.status(201).json(playlistSong);
  })
);

// ---------------------------------------------------------------------------
// DELETE /api/playlists/:id/songs/:songId
//
// Removes a song from a playlist. Does not delete the song from the library.
// Playlist owner or admin.
// ---------------------------------------------------------------------------
router.delete(
  '/:id/songs/:songId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { id: playlistId, songId } = req.params;
    const pid = playlistId as string;
    const sid = songId as string;

    // Fetch the playlist and check ownership
    const playlist = await requirePlaylistAccess(pid, req.user, res, 'remove songs');
    if (!playlist) return;

    const entry = await prisma.playlistSong.findUnique({
      where: {
        playlistId_songId: {
          playlistId: pid,
          songId: sid,
        },
      },
    });

    if (!entry) {
      res.status(404).json({ error: 'Song not found in playlist.' });
      return;
    }

    // Delete and re-index in a transaction to prevent inconsistent positions.
    await prisma.$transaction(async (tx) => {
      await tx.playlistSong.delete({
        where: {
          playlistId_songId: {
            playlistId: pid,
            songId: sid,
          },
        },
      });

      // Re-index remaining songs to close the gap in positions.
      const remaining = await tx.playlistSong.findMany({
        where: { playlistId: pid },
        orderBy: { position: 'asc' },
      });

      await Promise.all(
        remaining.map((ps: { id: string }, index: number) =>
          tx.playlistSong.update({
            where: { id: ps.id },
            data: { position: index },
          })
        )
      );
    });

    await emitPlaylistBroadcast(pid);
    res.status(204).send();
  })
);

export default router;

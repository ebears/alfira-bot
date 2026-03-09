import { Router } from 'express';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/requireAuth';
import { asyncHandler } from '../middleware/errorHandler';
import { emitPlaylistUpdated } from '../lib/socket';
import { getClient } from '@discord-music-bot/bot/src/lib/client';

const router = Router();
const MAX_NAME_LENGTH = 200;

// ---------------------------------------------------------------------------
// Helper: Fetch user's display name from Discord
// Returns nickname if set, otherwise username
// ---------------------------------------------------------------------------
async function getUserDisplayName(discordId: string): Promise<string> {
  const client = getClient();
  if (!client) return discordId;

  try {
    // Use the configured guild ID from environment
    const guildId = process.env.GUILD_ID;
    if (!guildId) return discordId;

    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(discordId);
    return member.displayName || member.user.username || discordId;
  } catch {
    return discordId;
  }
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
      include: { _count: { select: { songs: true } } },
    });

    // Filter private playlists: only visible to creator and admins (in Admin View)
    const filteredPlaylists = playlists.filter((pl) => {
      if (!pl.isPrivate) return true;
      const isCreator = pl.createdBy === req.user?.discordId;
      const isAdminInAdminView = req.user?.isAdmin && adminView;
      return isCreator || isAdminInAdminView;
    });

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

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'name is required.' });
      return;
    }

    if (name.length > MAX_NAME_LENGTH) {
      res.status(400).json({ error: `name must be ${MAX_NAME_LENGTH} characters or less.` });
      return;
    }

    const playlist = await prisma.playlist.create({
      data: {
        name: name.trim(),
        createdBy: req.user?.discordId,
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
    const playlist = await prisma.playlist.findUnique({
      where: { id: req.params.id as string },
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
      const isCreator = playlist.createdBy === req.user?.discordId;
      const isAdminInAdminView = req.user?.isAdmin && adminView;
      if (!isCreator && !isAdminInAdminView) {
        res.status(403).json({ error: 'Access denied. This playlist is private.' });
        return;
      }
    }

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

    const existing = await prisma.playlist.findUnique({
      where: { id: req.params.id as string },
    });

    if (!existing) {
      res.status(404).json({ error: 'Playlist not found.' });
      return;
    }

    // Check permissions: creator or admin (in Admin View)
    const isCreator = existing.createdBy === req.user?.discordId;
    const isAdminInAdminView = req.user?.isAdmin && adminView;
    if (!isCreator && !isAdminInAdminView) {
      res
        .status(403)
        .json({ error: 'Only the creator or admins (in Admin View) can change visibility.' });
      return;
    }

    const playlist = await prisma.playlist.update({
      where: { id: req.params.id as string },
      data: { isPrivate },
      include: { _count: { select: { songs: true } } },
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

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'name is required.' });
      return;
    }

    if (name.length > MAX_NAME_LENGTH) {
      res.status(400).json({ error: `name must be ${MAX_NAME_LENGTH} characters or less.` });
      return;
    }

    const existing = await prisma.playlist.findUnique({
      where: { id: req.params.id as string },
    });

    if (!existing) {
      res.status(404).json({ error: 'Playlist not found.' });
      return;
    }

    // Check permissions: playlist owner or admin
    const isOwner = existing.createdBy === req.user?.discordId;
    const isAdmin = req.user?.isAdmin;
    if (!isOwner && !isAdmin) {
      res
        .status(403)
        .json({ error: 'Only the playlist owner or admins can rename this playlist.' });
      return;
    }

    const playlist = await prisma.playlist.update({
      where: { id: req.params.id as string },
      data: { name: name.trim() },
      include: { _count: { select: { songs: true } } },
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
    const existing = await prisma.playlist.findUnique({
      where: { id: req.params.id as string },
    });

    if (!existing) {
      res.status(404).json({ error: 'Playlist not found.' });
      return;
    }

    // Check permissions: playlist owner or admin
    const isOwner = existing.createdBy === req.user?.discordId;

    const isAdmin = req.user?.isAdmin;

    if (!isOwner && !isAdmin) {
      res
        .status(403)
        .json({ error: 'Only the playlist owner or admins can delete this playlist.' });
      return;
    }

    await prisma.playlist.delete({ where: { id: req.params.id as string } });

    // No playlist:deleted event needed — the web UI uses the playlists:updated
    // event to re-fetch the list. For deletions, clients will notice the item
    // is gone on the next fetch triggered by the event. A dedicated
    // playlists:deleted event with just the ID could be added later for
    // instant optimistic removal, but it is not in scope for Phase 8.
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

    const [playlist, song] = await Promise.all([
      prisma.playlist.findUnique({ where: { id: req.params.id as string } }),
      prisma.song.findUnique({ where: { id: songId } }),
    ]);

    if (!playlist) {
      res.status(404).json({ error: 'Playlist not found.' });
      return;
    }

    if (!song) {
      res.status(404).json({ error: 'Song not found.' });
      return;
    }

    // Check permissions: playlist owner or admin
    const isOwner = playlist.createdBy === req.user?.discordId;
    const isAdmin = req.user?.isAdmin;
    if (!isOwner && !isAdmin) {
      res
        .status(403)
        .json({ error: 'Only the playlist owner or admins can add songs to this playlist.' });
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

    // Fetch the updated playlist with the new song count for the broadcast.
    const updatedPlaylist = await prisma.playlist.findUnique({
      where: { id: playlist.id },
      include: { _count: { select: { songs: true } } },
    });

    if (updatedPlaylist) emitPlaylistUpdated(updatedPlaylist);
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

    // Fetch the playlist to check ownership
    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId as string },
    });

    if (!playlist) {
      res.status(404).json({ error: 'Playlist not found.' });
      return;
    }

    // Check permissions: playlist owner or admin
    const isOwner = playlist.createdBy === req.user?.discordId;
    const isAdmin = req.user?.isAdmin;

    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: 'Only the playlist owner or admins can remove songs.' });
      return;
    }

    const entry = await prisma.playlistSong.findUnique({
      where: {
        playlistId_songId: {
          playlistId: playlistId as string,
          songId: songId as string,
        },
      },
    });

    if (!entry) {
      res.status(404).json({ error: 'Song not found in playlist.' });
      return;
    }

    await prisma.playlistSong.delete({
      where: {
        playlistId_songId: {
          playlistId: playlistId as string,
          songId: songId as string,
        },
      },
    });

    // Re-index remaining songs to close the gap in positions.
    const remaining = await prisma.playlistSong.findMany({
      where: { playlistId: playlistId as string },
      orderBy: { position: 'asc' },
    });

    await Promise.all(
      remaining.map((ps: { id: string }, index: number) =>
        prisma.playlistSong.update({
          where: { id: ps.id },
          data: { position: index },
        })
      )
    );

    // Broadcast the updated playlist with the new song count.
    const updatedPlaylist = await prisma.playlist.findUnique({
      where: { id: playlistId as string },
      include: { _count: { select: { songs: true } } },
    });

    if (updatedPlaylist) emitPlaylistUpdated(updatedPlaylist);
    res.status(204).send();
  })
);

export default router;

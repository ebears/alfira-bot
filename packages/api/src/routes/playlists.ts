import { Router } from 'express';
import prisma from '../lib/prisma';
import { requireAuth } from '../middleware/requireAuth';
import { requireAdmin } from '../middleware/requireAdmin';
import { asyncHandler } from '../middleware/errorHandler';
import { emitPlaylistUpdated } from '../lib/socket';

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/playlists
//
// Returns all playlists with a count of songs in each. Member accessible.
// ---------------------------------------------------------------------------
router.get(
  '/',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const playlists = await prisma.playlist.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { songs: true } },
      },
    });
    res.json(playlists);
  })
);

// ---------------------------------------------------------------------------
// POST /api/playlists
//
// Creates a new empty playlist. Admin only.
// ---------------------------------------------------------------------------
router.post(
  '/',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { name } = req.body as { name?: string };

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'name is required.' });
      return;
    }

    const playlist = await prisma.playlist.create({
      data: {
        name: name.trim(),
        createdBy: req.user!.discordId,
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
    const playlist = await prisma.playlist.findUnique({
      where: { id: req.params.id },
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

    res.json(playlist);
  })
);

// ---------------------------------------------------------------------------
// PATCH /api/playlists/:id
//
// Renames a playlist. Admin only.
// ---------------------------------------------------------------------------
router.patch(
  '/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { name } = req.body as { name?: string };

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'name is required.' });
      return;
    }

    const existing = await prisma.playlist.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Playlist not found.' });
      return;
    }

    const playlist = await prisma.playlist.update({
      where: { id: req.params.id },
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
// PlaylistSong associations are removed (via cascade). Admin only.
// ---------------------------------------------------------------------------
router.delete(
  '/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const existing = await prisma.playlist.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Playlist not found.' });
      return;
    }

    await prisma.playlist.delete({ where: { id: req.params.id } });

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
// It is appended at the end (highest existing position + 1). Admin only.
// ---------------------------------------------------------------------------
router.post(
  '/:id/songs',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { songId } = req.body as { songId?: string };

    if (!songId) {
      res.status(400).json({ error: 'songId is required.' });
      return;
    }

    const [playlist, song] = await Promise.all([
      prisma.playlist.findUnique({ where: { id: req.params.id } }),
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

    // Check for duplicate.
    const existing = await prisma.playlistSong.findUnique({
      where: { playlistId_songId: { playlistId: playlist.id, songId: song.id } },
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
// Admin only.
// ---------------------------------------------------------------------------
router.delete(
  '/:id/songs/:songId',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id: playlistId, songId } = req.params;

    const entry = await prisma.playlistSong.findUnique({
      where: { playlistId_songId: { playlistId, songId } },
    });

    if (!entry) {
      res.status(404).json({ error: 'Song not found in playlist.' });
      return;
    }

    await prisma.playlistSong.delete({
      where: { playlistId_songId: { playlistId, songId } },
    });

    // Re-index remaining songs to close the gap in positions.
    const remaining = await prisma.playlistSong.findMany({
      where: { playlistId },
      orderBy: { position: 'asc' },
    });

    await Promise.all(
      remaining.map((ps, index) =>
        prisma.playlistSong.update({
          where: { id: ps.id },
          data: { position: index },
        })
      )
    );

    // Broadcast the updated playlist with the new song count.
    const updatedPlaylist = await prisma.playlist.findUnique({
      where: { id: playlistId },
      include: { _count: { select: { songs: true } } },
    });
    if (updatedPlaylist) emitPlaylistUpdated(updatedPlaylist);

    res.status(204).send();
  })
);

export default router;

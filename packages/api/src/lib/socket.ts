import type { Server as HTTPServer } from 'node:http';
import type { Playlist, QueueState, Song } from '@alfira-bot/shared';
import { parse } from 'cookie';
import { Server as SocketIOServer } from 'socket.io';
import { verifySessionToken } from '../middleware/requireAuth';
import { logger, WEB_UI_ORIGIN } from './config';

// Accept both Date and string createdAt — Drizzle uses Date at the DB level,
// but we serialize to ISO string for Socket.io JSON serialization.
type SerializedSong = Omit<Song, 'createdAt'> & { createdAt: string | Date };
type SerializedPlaylist = Omit<Playlist, 'createdAt'> & { createdAt: string | Date };

// Socket.io server singleton. Call initSocket(httpServer) once at startup.

let _io: SocketIOServer | null = null;

/**
 * Attach Socket.io to the HTTP server and store the instance.
 */
export function initSocket(httpServer: HTTPServer): SocketIOServer {
  _io = new SocketIOServer(httpServer, {
    cors: {
      origin: WEB_UI_ORIGIN,
      credentials: true,
    },
  });

  _io.use((socket, next) => {
    const cookies = parse(socket.handshake.headers.cookie || '');
    const token = cookies.session;

    if (!token) {
      next(new Error('Authentication required. Please log in.'));
      return;
    }

    const payload = verifySessionToken(token);
    if (!payload) {
      next(new Error('Session expired or invalid. Please log in again.'));
      return;
    }

    socket.data.user = payload;
    next();
  });

  _io.on('connection', (socket) => {
    logger.info({ socketId: socket.id, username: socket.data.user?.username }, 'Socket connected');
    socket.on('disconnect', (reason) => {
      logger.info({ socketId: socket.id, reason }, 'Socket disconnected');
    });
  });

  logger.info({ corsOrigin: WEB_UI_ORIGIN }, 'Socket.io initialised');
  return _io;
}

// ---------------------------------------------------------------------------
// Broadcast helpers
// ---------------------------------------------------------------------------

/**
 * Emit the full queue state to all connected clients.
 */
export function emitPlayerUpdate(state: QueueState): void {
  _io?.emit('player:update', state);
}

/**
 * Emit a newly added song to all connected clients.
 */
export function emitSongAdded(song: SerializedSong): void {
  _io?.emit('songs:added', {
    ...song,
    createdAt: song.createdAt instanceof Date ? song.createdAt.toISOString() : song.createdAt,
  });
}

/**
 * Emit the deleted song's ID to all connected clients.
 */
export function emitSongDeleted(id: string): void {
  _io?.emit('songs:deleted', id);
}

/**
 * Emit an updated song to all connected clients.
 */
export function emitSongUpdated(song: SerializedSong): void {
  _io?.emit('songs:updated', {
    ...song,
    createdAt: song.createdAt instanceof Date ? song.createdAt.toISOString() : song.createdAt,
  });
}

/**
 * Emit an updated playlist object to all connected clients.
 * Covers: create, rename, song added, song removed.
 */
export function emitPlaylistUpdated(playlist: SerializedPlaylist): void {
  _io?.emit('playlists:updated', {
    ...playlist,
    createdAt:
      playlist.createdAt instanceof Date ? playlist.createdAt.toISOString() : playlist.createdAt,
  });
}

/**
 * Get the Socket.io server instance (for graceful shutdown).
 */
export function getIo(): SocketIOServer | null {
  return _io;
}

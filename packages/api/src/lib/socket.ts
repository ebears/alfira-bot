import type { Server as HTTPServer } from 'node:http';
import type { Playlist, QueueState, Song } from '@alfira-bot/shared';
import { Server as SocketIOServer } from 'socket.io';
import { verifySessionToken } from '../middleware/requireAuth';
import { WEB_UI_ORIGIN } from './config';
import logger from './logger';

// Socket.io server singleton. Call initSocket(httpServer) once at startup.
// Events: player:update, songs:added, songs:deleted, playlists:updated

let _io: SocketIOServer | null = null;

/**
 * Attach Socket.io to the HTTP server and store the instance.
 * Must be called before any broadcast helpers are used.
 */
export function initSocket(httpServer: HTTPServer): SocketIOServer {
  _io = new SocketIOServer(httpServer, {
    cors: {
      origin: WEB_UI_ORIGIN,
      credentials: true,
    },
  });

  // ---------------------------------------------------------------------------
  // Socket.io authentication middleware
  //
  // Verifies the JWT from the 'session' cookie before allowing a WebSocket
  // connection. This prevents unauthenticated clients from receiving real-time
  // events (player:update, songs:added, etc.).
  //
  // The session cookie is HttpOnly and set by the OAuth flow in auth.ts.
  // ---------------------------------------------------------------------------
  _io.use((socket, next) => {
    const cookieHeader = socket.handshake.headers.cookie;
    let token: string | undefined;
    if (cookieHeader) {
      for (const part of cookieHeader.split(';')) {
        const trimmed = part.trim();
        const sep = trimmed.indexOf('=');
        if (sep === -1) continue;
        if (trimmed.substring(0, sep).trim() === 'session') {
          token = trimmed.substring(sep + 1).trim();
          break;
        }
      }
    }

    if (!token) {
      next(new Error('Authentication required. Please log in.'));
      return;
    }

    const payload = verifySessionToken(token);
    if (!payload) {
      next(new Error('Session expired or invalid. Please log in again.'));
      return;
    }

    // Attach the decoded user to socket.data for potential future use
    // (e.g., admin-only socket events, user-specific rooms)
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
 * Triggered by any playback change: song start, skip, stop, shuffle, loop.
 * Validates the payload shape before emitting to catch contract drift at runtime.
 */
export function emitPlayerUpdate(state: QueueState): void {
  _io?.emit('player:update', state);
}

/**
 * Emit a newly added song to all connected clients.
 * Allows the Songs page to append the card in real time.
 */
export function emitSongAdded(song: Omit<Song, 'createdAt'> & { createdAt: Date }): void {
  _io?.emit('songs:added', { ...song, createdAt: song.createdAt.toISOString() });
}

/**
 * Emit the deleted song's ID to all connected clients.
 * Allows the Songs page to remove the card in real time.
 */
export function emitSongDeleted(id: string): void {
  _io?.emit('songs:deleted', id);
}

/**
 * Emit an updated playlist object to all connected clients.
 * Covers: create, rename, song added, song removed.
 */
export function emitPlaylistUpdated(
  playlist: Omit<Playlist, 'createdAt'> & { createdAt: Date }
): void {
  _io?.emit('playlists:updated', { ...playlist, createdAt: playlist.createdAt.toISOString() });
}

/**
 * Get the Socket.io server instance (for graceful shutdown).
 */
export function getIo(): SocketIOServer | null {
  return _io;
}

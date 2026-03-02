import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import type { QueueState, Song, Playlist } from '@discord-music-bot/shared';

// ---------------------------------------------------------------------------
// socket.ts
//
// Socket.io server singleton.
//
// Usage:
//   1. Call initSocket(httpServer) once in the API entry point after creating
//      the HTTP server. This attaches Socket.io and stores the instance.
//   2. Import the broadcast helpers anywhere in the API (routes, etc.) to
//      push events to all connected clients.
//
// All events use a consistent naming convention: "<resource>:<action>"
//   player:update      — any queue or playback state change
//   songs:added        — a song was added to the library
//   songs:deleted      — a song was removed from the library
//   playlists:updated  — a playlist was created, renamed, or its songs changed
// ---------------------------------------------------------------------------

let _io: SocketIOServer | null = null;

// ---------------------------------------------------------------------------
// Cookie parser helper
//
// Parses the Cookie header string and returns an object mapping cookie names
// to values. Returns an empty object if the header is missing or malformed.
// ---------------------------------------------------------------------------
function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const name = trimmed.substring(0, separatorIndex).trim();
    const value = trimmed.substring(separatorIndex + 1).trim();
    cookies[name] = value;
  }

  return cookies;
}

const WEB_UI_ORIGIN = process.env.WEB_UI_ORIGIN ?? 'http://localhost:5173';

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
    const { JWT_SECRET } = process.env;

    if (!JWT_SECRET) {
      console.error('JWT_SECRET is not set — cannot verify Socket.io connections.');
      next(new Error('Server misconfiguration.'));
      return;
    }

    const cookieHeader = socket.handshake.headers.cookie;
    const cookies = parseCookies(cookieHeader);
    const token = cookies['session'];

    if (!token) {
      next(new Error('Authentication required. Please log in.'));
      return;
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET) as {
        discordId: string;
        username: string;
        avatar: string | null;
        isAdmin: boolean;
      };

      // Attach the decoded user to socket.data for potential future use
      // (e.g., admin-only socket events, user-specific rooms)
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Session expired or invalid. Please log in again.'));
    }
  });

  _io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id} (user: ${socket.data.user?.username})`);

    socket.on('disconnect', (reason) => {
      console.log(`🔌  Socket disconnected: ${socket.id} (${reason})`);
    });
  });

  console.log(`✅  Socket.io initialised (CORS origin: ${WEB_UI_ORIGIN})`);
  return _io;
}

/**
 * Retrieve the Socket.io server instance.
 * Returns null if initSocket() has not been called yet.
 */
export function getIO(): SocketIOServer | null {
  return _io;
}

// ---------------------------------------------------------------------------
// Broadcast helpers
// ---------------------------------------------------------------------------

/**
 * Emit the full queue state to all connected clients.
 * Triggered by any playback change: song start, skip, stop, shuffle, loop.
 */
export function emitPlayerUpdate(state: QueueState): void {
  _io?.emit('player:update', state);
}

/**
 * Emit a newly added song to all connected clients.
 * Allows the Songs page to append the card in real time.
 */
export function emitSongAdded(song: Song): void {
  _io?.emit('songs:added', song);
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
export function emitPlaylistUpdated(playlist: Playlist): void {
  _io?.emit('playlists:updated', playlist);
}

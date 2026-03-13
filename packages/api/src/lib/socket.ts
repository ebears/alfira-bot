import type { Server as HTTPServer } from 'node:http';
import type { Playlist, QueueState, Song } from '@alfira-bot/shared';
import jwt from 'jsonwebtoken';
import { Server as SocketIOServer } from 'socket.io';

type PrismaPlaylist = Omit<Playlist, 'createdAt'> & { createdAt: Date };
type PrismaSong = Omit<Song, 'createdAt'> & { createdAt: Date };

function songToWire(song: PrismaSong): Song {
  return {
    ...song,
    createdAt: song.createdAt.toISOString(),
  };
}

function playlistToWire(playlist: PrismaPlaylist): Playlist {
  return {
    ...playlist,
    createdAt: playlist.createdAt.toISOString(),
  };
}

// Socket.io server singleton. Call initSocket(httpServer) once at startup.
// Events: player:update, songs:added, songs:deleted, playlists:updated

let _io: SocketIOServer | null = null;

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
    const token = cookies.session;

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
      console.log(`🔌 Socket disconnected: ${socket.id} (${reason})`);
    });
  });

  console.log(`✅ Socket.io initialised (CORS origin: ${WEB_UI_ORIGIN})`);
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
export function emitSongAdded(song: PrismaSong): void {
  _io?.emit('songs:added', songToWire(song));
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
export function emitPlaylistUpdated(playlist: PrismaPlaylist): void {
  _io?.emit('playlists:updated', playlistToWire(playlist));
}

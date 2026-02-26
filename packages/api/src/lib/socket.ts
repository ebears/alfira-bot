import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
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

  _io.on('connection', (socket) => {
    console.log(`🔌  Socket connected: ${socket.id}`);

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

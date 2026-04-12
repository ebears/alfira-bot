import type { Playlist, QueueState, Song, User } from '@alfira-bot/shared';
import { logger } from './config';

import { formatSong } from './serialization';

// Accept both Date and string createdAt — Drizzle uses Date at the DB level,
// but we serialize to ISO string for JSON serialization.
type SerializedSong = Omit<Song, 'createdAt'> & { createdAt: string | Date };
type SerializedPlaylist = Omit<Playlist, 'createdAt'> & { createdAt: string | Date };

// ---------------------------------------------------------------------------
// WebSocket client registry
// ---------------------------------------------------------------------------

// biome-ignore lint/suspicious/noExplicitAny: Bun's WebSocket type is incompatible with global WebSocket
const clients = new Set<any>();

/**
 * Registers a newly connected WebSocket client after auth in fetch().
 */
export function registerClient(
  // biome-ignore lint/suspicious/noExplicitAny: Bun's WebSocket type is incompatible with global WebSocket
  ws: any,
  user: User
): void {
  clients.add(ws);
  logger.info({ socketId: ws.id, username: user.username }, 'WebSocket client connected');
}

/**
 * Removes a disconnected WebSocket client.
 */
export function unregisterClient(
  // biome-ignore lint/suspicious/noExplicitAny: Bun's WebSocket type is incompatible with global WebSocket
  ws: any
): void {
  clients.delete(ws);
  logger.info({ socketId: ws.id }, 'WebSocket client disconnected');
}

// ---------------------------------------------------------------------------
// Broadcast helpers
// ---------------------------------------------------------------------------

/**
 * Emit the full queue state to all connected clients.
 */
export function emitPlayerUpdate(state: QueueState): void {
  const message = JSON.stringify({ event: 'player:update', data: state });
  for (const client of clients) {
    client.send(message);
  }
}

/**
 * Emit a newly added song to all connected clients.
 */
export function emitSongAdded(song: SerializedSong): void {
  const payload = formatSong(song);
  const message = JSON.stringify({ event: 'songs:added', data: payload });
  for (const client of clients) {
    client.send(message);
  }
}

/**
 * Emit the deleted song's ID to all connected clients.
 */
export function emitSongDeleted(id: string): void {
  const message = JSON.stringify({ event: 'songs:deleted', data: id });
  for (const client of clients) {
    client.send(message);
  }
}

/**
 * Emit an updated song to all connected clients.
 */
export function emitSongUpdated(song: SerializedSong): void {
  const payload = formatSong(song);
  const message = JSON.stringify({ event: 'songs:updated', data: payload });
  for (const client of clients) {
    client.send(message);
  }
}

/**
 * Emit an updated playlist object to all connected clients.
 * Covers: create, rename, song added, song removed.
 */
export function emitPlaylistUpdated(playlist: SerializedPlaylist): void {
  const message = JSON.stringify({ event: 'playlists:updated', data: playlist });
  for (const client of clients) {
    client.send(message);
  }
}

/**
 * Close all connected WebSocket clients gracefully.
 */
export function closeAllClients(): void {
  for (const client of clients) {
    client.close();
  }
  clients.clear();
}

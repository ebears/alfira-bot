import type { Playlist, QueueState, Song, User } from '@alfira-bot/shared';
import { logger } from './config';

// Accept both Date and string createdAt — Drizzle uses Date at the DB level,
// but we serialize to ISO string for JSON serialization.
export type SerializedSong = Omit<Song, 'createdAt'> & { createdAt: string | Date };
type SerializedPlaylist = Omit<Playlist, 'createdAt'> & { createdAt: string | Date };

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

export function formatSong(s: {
  createdAt: Date | string;
  tags?: string[] | null;
}): SerializedSong {
  return {
    ...s,
    createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
    tags: s.tags ?? [],
  } as SerializedSong;
}

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

function serializeMessage(event: string, data: unknown): string {
  return JSON.stringify({ event, data });
}

/**
 * Emit the full queue state to all connected clients.
 */
export function emitPlayerUpdate(state: QueueState): void {
  const message = serializeMessage('player:update', state);
  for (const client of clients) {
    client.send(message);
  }
}

/**
 * Emit a newly added song to all connected clients.
 */
export function emitSongAdded(song: SerializedSong): void {
  const payload = formatSong(song);
  const message = serializeMessage('songs:added', payload);
  for (const client of clients) {
    client.send(message);
  }
}

/**
 * Emit the deleted song's ID to all connected clients.
 */
export function emitSongDeleted(id: string): void {
  const message = serializeMessage('songs:deleted', id);
  for (const client of clients) {
    client.send(message);
  }
}

/**
 * Emit an updated song to all connected clients.
 */
export function emitSongUpdated(song: SerializedSong): void {
  const payload = formatSong(song);
  const message = serializeMessage('songs:updated', payload);
  for (const client of clients) {
    client.send(message);
  }
}

/**
 * Emit an updated playlist object to all connected clients.
 * Covers: create, rename, song added, song removed.
 */
export function emitPlaylistUpdated(playlist: SerializedPlaylist): void {
  const message = serializeMessage('playlists:updated', playlist);
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

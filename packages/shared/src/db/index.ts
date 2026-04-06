import { and, asc, count, desc, eq, gt, gte, ilike, inArray, lt, lte, or, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// ---------------------------------------------------------------------------
// Drizzle client singleton
//
// Shared between the API and bot packages. Both run in the same Node.js
// process, so this does not open a second physical socket.
// ---------------------------------------------------------------------------

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const queryClient = postgres(DATABASE_URL, { prepare: false });
export const db = drizzle(queryClient, { schema });

export type * from './schema';
export * as schema from './schema';
/** Re-export the underlying postgres client for shutdown/health checks. */
// Re-export drizzle-orm operators so consumers don't need drizzle-orm as a direct dependency.
export {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  lt,
  lte,
  or,
  queryClient as $client,
  sql,
};

// ---------------------------------------------------------------------------
// Tables shorthand — for direct consumer use in route files.
// ---------------------------------------------------------------------------
export const tables = {
  song: schema.song,
  playlist: schema.playlist,
  playlistSong: schema.playlistSong,
  refreshToken: schema.refreshToken,
};

// ---------------------------------------------------------------------------
// Relations — helpers for multi-table queries that replace Prisma includes.
// ---------------------------------------------------------------------------

/** Fetch a single playlist with its songs ordered by position. */
export async function findPlaylistWithSongs(playlistId: string) {
  const result = await db
    .select()
    .from(schema.playlist)
    .leftJoin(schema.playlistSong, eq(schema.playlistSong.playlistId, schema.playlist.id))
    .leftJoin(schema.song, eq(schema.song.id, schema.playlistSong.songId))
    .where(eq(schema.playlist.id, playlistId));

  if (result.length === 0) return null;

  const songs = result
    .filter((r) => r.PlaylistSong !== null && r.Song !== null)
    .sort((a, b) => (a.PlaylistSong?.position ?? 0) - (b.PlaylistSong?.position ?? 0))
    .map(
      (r) =>
        ({
          ...r.PlaylistSong,
          song: r.Song,
        }) as {
          id: string;
          playlistId: string;
          songId: string;
          position: number;
          song: typeof schema.song.$inferSelect;
        }
    );

  return { ...result[0].Playlist, songs };
}

/** Fetch a single playlist with its song count. */
export async function findPlaylistWithCount(playlistId: string) {
  const [pl] = await db.select().from(schema.playlist).where(eq(schema.playlist.id, playlistId));
  if (!pl) return null;

  const [{ value }] = await db
    .select({ value: count() })
    .from(schema.playlistSong)
    .where(eq(schema.playlistSong.playlistId, pl.id));

  return { ...pl, _count: { songs: value } };
}

/** Fetch playlists with song counts. Returns items and total count. */
export async function findPlaylistsWithCount(opts: { offset: number; limit: number }) {
  const [totalRows] = await db.select({ count: count() }).from(schema.playlist);
  const items = await db
    .select()
    .from(schema.playlist)
    .orderBy(schema.playlist.createdAt)
    .limit(opts.limit)
    .offset(opts.offset);

  const counts = await Promise.all(
    items.map(async (pl) => {
      const [{ value }] = await db
        .select({ value: count() })
        .from(schema.playlistSong)
        .where(eq(schema.playlistSong.playlistId, pl.id));
      return { ...pl, _count: { songs: value } };
    })
  );

  return { items: counts, total: totalRows.count };
}

export default db;

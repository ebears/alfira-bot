import type { Playlist, PlaylistSong, Song } from './types';

/**
 * Prisma include options for fetching a playlist with its songs ordered by position.
 * Used by both the bot and API packages to ensure consistent playlist fetching.
 */
export const PLAYLIST_SONGS_INCLUDE = {
  songs: {
    orderBy: { position: 'asc' as const },
    include: { song: true },
  },
} as const;

/**
 * Database result type for a playlist with songs included.
 * This matches the raw Prisma output before transformation to shared types.
 */
export type PlaylistWithSongsDb = Playlist & {
  songs: (PlaylistSong & { song: Song & { createdAt: Date } })[];
};

/**
 * Transforms a database playlist with songs into the API PlaylistDetail format.
 */
export function transformPlaylistDbToDetail(playlist: PlaylistWithSongsDb): {
  id: string;
  name: string;
  createdBy: string;
  createdByDisplayName?: string;
  isPrivate: boolean;
  createdAt: string;
  songs: (PlaylistSong & { song: Song })[];
} {
  return {
    ...playlist,
    createdAt: playlist.createdAt.toISOString(),
    songs: playlist.songs.map((ps) => ({
      ...ps,
      song: { ...ps.song, createdAt: ps.song.createdAt.toISOString() },
    })),
  };
}

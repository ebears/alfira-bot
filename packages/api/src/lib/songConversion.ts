import type { QueuedSong, Song } from '@alfira-bot/shared';

/**
 * Converts a database song to a queued song with requested by information.
 */
export function dbSongToQueuedSong(
  song: Omit<Song, 'createdAt'> & { createdAt: Date },
  requestedBy: string
): QueuedSong {
  return {
    ...song,
    createdAt: song.createdAt.toISOString(),
    requestedBy,
  };
}

/**
 * Builds a queued song from YouTube metadata.
 * Used for quick-add and priority queue operations with non-library songs.
 */
export function buildQueuedSongFromMetadata(
  metadata: { title: string; youtubeId: string; duration: number; thumbnailUrl: string },
  youtubeUrl: string,
  requestedBy: string,
  addedBy: string
): QueuedSong {
  return {
    id: `temp-${Date.now()}`,
    title: metadata.title,
    youtubeUrl,
    youtubeId: metadata.youtubeId,
    duration: metadata.duration,
    thumbnailUrl: metadata.thumbnailUrl,
    addedBy,
    createdAt: new Date().toISOString(),
    requestedBy,
  };
}

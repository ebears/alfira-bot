import {
  getMetadata,
  getPlaylistMetadataWithVideos,
  isValidYouTubeUrl,
  isYouTubePlaylistUrl,
} from '@alfira-bot/bot/src/utils/ytdlp';
import type { QueuedSong } from '@alfira-bot/shared';
import type { Response } from 'express';

const MAX_URL_LENGTH = 2000;

/**
 * Base URL validation: checks type, length, and calls a format validator.
 * Returns the trimmed URL or null (response already sent on error).
 */
function validateUrlBase(
  youtubeUrl: unknown,
  res: Response,
  validate: (url: string) => boolean,
  errorMessage: string
): string | null {
  if (!youtubeUrl || typeof youtubeUrl !== 'string') {
    res.status(400).json({ error: 'youtubeUrl is required.' });
    return null;
  }

  const url = youtubeUrl.trim();

  if (url.length > MAX_URL_LENGTH) {
    res.status(400).json({ error: `URL must be ${MAX_URL_LENGTH} characters or less.` });
    return null;
  }

  if (!validate(url)) {
    res.status(400).json({ error: errorMessage });
    return null;
  }

  return url;
}

/**
 * Validates a YouTube URL for single video endpoints.
 * Sends error response and returns null if invalid, otherwise returns the trimmed URL.
 */
export function validateYouTubeUrl(youtubeUrl: unknown, res: Response): string | null {
  return validateUrlBase(
    youtubeUrl,
    res,
    isValidYouTubeUrl,
    'That does not look like a valid YouTube URL.'
  );
}

/**
 * Validates a YouTube playlist URL.
 * Sends error response and returns null if invalid, otherwise returns the trimmed URL.
 */
export function validateYouTubePlaylistUrl(youtubeUrl: unknown, res: Response): string | null {
  return validateUrlBase(
    youtubeUrl,
    res,
    isYouTubePlaylistUrl,
    'That does not look like a valid YouTube playlist URL. It should contain a "list" parameter.'
  );
}

/**
 * Fetches YouTube metadata for a single video URL.
 * Sends error response and returns null if fetch fails.
 */
export async function fetchYouTubeMetadata(
  url: string,
  res: Response
): Promise<Awaited<ReturnType<typeof getMetadata>> | null> {
  try {
    return await getMetadata(url);
  } catch {
    res.status(422).json({
      error:
        'Could not fetch video info. The video may be private, age-restricted, or unavailable.',
    });
    return null;
  }
}

/**
 * Fetches YouTube playlist metadata with videos.
 * Sends error response and returns null if fetch fails.
 */
export async function fetchPlaylistMetadata(
  url: string,
  res: Response,
  maxVideos?: number
): Promise<Awaited<ReturnType<typeof getPlaylistMetadataWithVideos>> | null> {
  try {
    return await getPlaylistMetadataWithVideos(url, maxVideos);
  } catch {
    res.status(422).json({
      error: 'Could not fetch playlist info. The playlist may be private or unavailable.',
    });
    return null;
  }
}

/**
 * Builds a QueuedSong from YouTube metadata (not in the library).
 * Used by quick-add and override endpoints.
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

// ---------------------------------------------------------------------------
// PrismaSong: A song as returned from Prisma (with Date createdAt).
// PrismaSongLike: Interface for objects compatible with PrismaSong.
// ---------------------------------------------------------------------------

type PrismaSongLike = {
  id: string;
  title: string;
  youtubeUrl: string;
  youtubeId: string;
  duration: number;
  thumbnailUrl: string;
  addedBy: string;
  nickname?: string | null;
  createdAt: Date;
};

/**
 * Converts a Prisma song (with Date createdAt) to a QueuedSong (with string createdAt).
 * Used by player routes when loading songs from the database for queue operations.
 */
export function dbSongToQueuedSong(song: PrismaSongLike, requestedBy: string): QueuedSong {
  return {
    ...song,
    createdAt: song.createdAt.toISOString(),
    requestedBy,
  };
}

import {
  getMetadata,
  getPlaylistMetadataWithVideos,
  isValidYouTubeUrl,
  isYouTubePlaylistUrl,
} from '@alfira-bot/bot';
import type { Response } from 'express';

const MAX_URL_LENGTH = 2000;

function validateUrl(
  youtubeUrl: unknown,
  res: Response,
  validator: (url: string) => boolean,
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

  if (!validator(url)) {
    res.status(400).json({ error: errorMessage });
    return null;
  }

  return url;
}

async function fetchMetadata<T>(
  fetcher: () => Promise<T>,
  res: Response,
  errorMessage: string
): Promise<T | null> {
  try {
    return await fetcher();
  } catch {
    res.status(422).json({ error: errorMessage });
    return null;
  }
}

/** Validates a YouTube URL for single video endpoints. */
export function validateYouTubeUrl(youtubeUrl: unknown, res: Response): string | null {
  return validateUrl(
    youtubeUrl,
    res,
    isValidYouTubeUrl,
    'That does not look like a valid YouTube URL.'
  );
}

/** Validates a YouTube playlist URL. */
export function validateYouTubePlaylistUrl(youtubeUrl: unknown, res: Response): string | null {
  return validateUrl(
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
export function fetchYouTubeMetadata(
  url: string,
  res: Response
): Promise<Awaited<ReturnType<typeof getMetadata>> | null> {
  return fetchMetadata(
    () => getMetadata(url),
    res,
    'Could not fetch video info. The video may be private, age-restricted, or unavailable.'
  );
}

/**
 * Fetches YouTube playlist metadata with videos.
 * Sends error response and returns null if fetch fails.
 */
export function fetchPlaylistMetadata(
  url: string,
  res: Response,
  maxVideos?: number
): Promise<Awaited<ReturnType<typeof getPlaylistMetadataWithVideos>> | null> {
  return fetchMetadata(
    () => getPlaylistMetadataWithVideos(url, maxVideos),
    res,
    'Could not fetch playlist info. The playlist may be private or unavailable.'
  );
}

/** Clamps maxVideos to the [1, 100] range, or returns undefined if not set. */
export function clampMaxVideos(value: number | undefined): number | undefined {
  return value === undefined ? undefined : Math.min(Math.max(1, value), 100);
}

/** Returns a canonical YouTube watch URL for a given video ID. */
export function youTubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

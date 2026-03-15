import {
  getMetadata,
  getPlaylistMetadataWithVideos,
  isValidYouTubeUrl,
  isYouTubePlaylistUrl,
} from '@alfira-bot/bot/src/utils/ytdlp';
import type { Response } from 'express';

const MAX_URL_LENGTH = 2000;

/** Validates a YouTube URL for single video endpoints. */
export function validateYouTubeUrl(youtubeUrl: unknown, res: Response): string | null {
  if (!youtubeUrl || typeof youtubeUrl !== 'string') {
    res.status(400).json({ error: 'youtubeUrl is required.' });
    return null;
  }

  const url = youtubeUrl.trim();

  if (url.length > MAX_URL_LENGTH) {
    res.status(400).json({ error: `URL must be ${MAX_URL_LENGTH} characters or less.` });
    return null;
  }

  if (!isValidYouTubeUrl(url)) {
    res.status(400).json({ error: 'That does not look like a valid YouTube URL.' });
    return null;
  }

  return url;
}

/** Validates a YouTube playlist URL. */
export function validateYouTubePlaylistUrl(youtubeUrl: unknown, res: Response): string | null {
  if (!youtubeUrl || typeof youtubeUrl !== 'string') {
    res.status(400).json({ error: 'youtubeUrl is required.' });
    return null;
  }

  const url = youtubeUrl.trim();

  if (url.length > MAX_URL_LENGTH) {
    res.status(400).json({ error: `URL must be ${MAX_URL_LENGTH} characters or less.` });
    return null;
  }

  if (!isYouTubePlaylistUrl(url)) {
    res.status(400).json({
      error:
        'That does not look like a valid YouTube playlist URL. It should contain a "list" parameter.',
    });
    return null;
  }

  return url;
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

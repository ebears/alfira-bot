import {
  getMetadata,
  getPlaylistMetadataWithVideos,
  isValidYouTubeUrl,
  isYouTubePlaylistUrl,
} from '@alfira-bot/bot';
import type { Response } from 'express';

const MAX_URL_LENGTH = 2000;

/**
 * Validates and trims a URL input. Returns null if validation fails.
 * Used by YouTube URL validators to avoid duplication.
 */
function validateUrlInput(youtubeUrl: unknown, res: Response): string | null {
  if (!youtubeUrl || typeof youtubeUrl !== 'string') {
    res.status(400).json({ error: 'youtubeUrl is required.' });
    return null;
  }

  const url = youtubeUrl.trim();

  if (url.length > MAX_URL_LENGTH) {
    res.status(400).json({ error: `URL must be ${MAX_URL_LENGTH} characters or less.` });
    return null;
  }

  return url;
}

/** Validates a YouTube URL for single video endpoints. */
export function validateYouTubeUrl(youtubeUrl: unknown, res: Response): string | null {
  const url = validateUrlInput(youtubeUrl, res);
  if (!url) return null;

  if (!isValidYouTubeUrl(url)) {
    res.status(400).json({ error: 'That does not look like a valid YouTube URL.' });
    return null;
  }

  return url;
}

/** Validates a YouTube playlist URL. */
export function validateYouTubePlaylistUrl(youtubeUrl: unknown, res: Response): string | null {
  const url = validateUrlInput(youtubeUrl, res);
  if (!url) return null;

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

/** Clamps maxVideos to the [1, 100] range, or returns undefined if not set. */
export function clampMaxVideos(value: number | undefined): number | undefined {
  return value === undefined ? undefined : Math.min(Math.max(1, value), 100);
}

/** Returns a canonical YouTube watch URL for a given video ID. */
export function youTubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/** Validates and trims a playlist name. */
export function validatePlaylistName(name: unknown, res: Response): string | null {
  const MAX_NAME_LENGTH = 200;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'name is required.' });
    return null;
  }
  if (name.length > MAX_NAME_LENGTH) {
    res.status(400).json({ error: `name must be ${MAX_NAME_LENGTH} characters or less.` });
    return null;
  }
  return name.trim();
}

/** Validates and trims a nickname. Returns null if invalid, otherwise the trimmed value or null. */
export function validateNickname(nickname: unknown, res: Response): string | null | false {
  const MAX_NICKNAME_LENGTH = 50;
  if (nickname !== undefined && nickname !== null && typeof nickname !== 'string') {
    res.status(400).json({ error: 'nickname must be a string.' });
    return false;
  }
  const trimmed = nickname ? (nickname as string).trim() || null : null;
  if (trimmed && trimmed.length > MAX_NICKNAME_LENGTH) {
    res.status(400).json({ error: `Nickname must be ${MAX_NICKNAME_LENGTH} characters or fewer.` });
    return false;
  }
  return trimmed;
}

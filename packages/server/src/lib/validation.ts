import {
  getMetadata,
  getPlaylistMetadataWithVideos,
  isValidYouTubeUrl,
  isYouTubePlaylistUrl,
} from '../startDiscord';
import { json } from './json';

const MAX_URL_LENGTH = 2000;

type ValidationSuccess<T> = { ok: true; value: T };
type ValidationError = { ok: false; response: Response };
type ValidationResult<T> = ValidationSuccess<T> | ValidationError;

/**
 * Validates and trims a URL input. Returns null if validation fails.
 * Used by YouTube URL validators to avoid duplication.
 */
function validateUrlInput(youtubeUrl: unknown): ValidationResult<string> {
  if (!youtubeUrl || typeof youtubeUrl !== 'string') {
    return { ok: false, response: json({ error: 'youtubeUrl is required.' }, 400) };
  }

  const url = youtubeUrl.trim();

  if (url.length > MAX_URL_LENGTH) {
    return {
      ok: false,
      response: json({ error: `URL must be ${MAX_URL_LENGTH} characters or less.` }, 400),
    };
  }

  return { ok: true, value: url };
}

/** Validates a YouTube URL for single video endpoints. */
export function validateYouTubeUrl(youtubeUrl: unknown): ValidationResult<string> {
  const result = validateUrlInput(youtubeUrl);
  if (!result.ok) return result;

  if (!isValidYouTubeUrl(result.value)) {
    return {
      ok: false,
      response: json({ error: 'That does not look like a valid YouTube URL.' }, 400),
    };
  }

  return result;
}

/** Validates a YouTube playlist URL. */
export function validateYouTubePlaylistUrl(youtubeUrl: unknown): ValidationResult<string> {
  const result = validateUrlInput(youtubeUrl);
  if (!result.ok) return result;

  if (!isYouTubePlaylistUrl(result.value)) {
    return {
      ok: false,
      response: json(
        {
          error:
            'That does not look like a valid YouTube playlist URL. It should contain a "list" parameter.',
        },
        400
      ),
    };
  }

  return result;
}

async function wrapBotCall<T>(
  fn: () => Promise<T>,
  errorMsg: string
): Promise<{ ok: true; value: T } | { ok: false; response: Response }> {
  try {
    return { ok: true, value: await fn() };
  } catch {
    return { ok: false, response: json({ error: errorMsg }, 422) };
  }
}

/**
 * Fetches YouTube metadata for a single video URL.
 * Returns error Response if fetch fails.
 */
export function fetchYouTubeMetadata(
  url: string
): Promise<
  { ok: true; value: Awaited<ReturnType<typeof getMetadata>> } | { ok: false; response: Response }
> {
  return wrapBotCall(
    () => getMetadata(url),
    'Could not fetch video info. The video may be private, age-restricted, or unavailable.'
  );
}

/**
 * Fetches YouTube playlist metadata with videos.
 * Returns error Response if fetch fails.
 */
export function fetchPlaylistMetadata(
  url: string,
  maxVideos?: number
): Promise<
  | { ok: true; value: Awaited<ReturnType<typeof getPlaylistMetadataWithVideos>> }
  | { ok: false; response: Response }
> {
  return wrapBotCall(
    () => getPlaylistMetadataWithVideos(url, maxVideos),
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

/** Validates and trims a playlist name. */
export function validatePlaylistName(name: unknown): ValidationResult<string> {
  const MAX_NAME_LENGTH = 200;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return { ok: false, response: json({ error: 'name is required.' }, 400) };
  }
  if (name.length > MAX_NAME_LENGTH) {
    return {
      ok: false,
      response: json({ error: `name must be ${MAX_NAME_LENGTH} characters or less.` }, 400),
    };
  }
  return { ok: true, value: name.trim() };
}

/** Validates and trims a nickname. Returns null for empty/missing, error Response for invalid type/length. */
export function validateNickname(nickname: unknown): ValidationResult<string | null> {
  const MAX_NICKNAME_LENGTH = 50;
  if (nickname !== undefined && nickname !== null && typeof nickname !== 'string') {
    return { ok: false, response: json({ error: 'nickname must be a string.' }, 400) };
  }
  const trimmed = nickname ? String(nickname).trim() || null : null;
  if (trimmed && trimmed.length > MAX_NICKNAME_LENGTH) {
    return {
      ok: false,
      response: json(
        { error: `Nickname must be ${MAX_NICKNAME_LENGTH} characters or fewer.` },
        400
      ),
    };
  }
  return { ok: true, value: trimmed };
}

/** Validates an optional string field. Trims and returns null if empty. */
export function validateOptionalString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** Validates an artwork URL. Trims and checks it's a valid URL if non-empty. */
export function validateArtworkUrl(value: unknown): ValidationResult<string | null> {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== 'string')
    return { ok: false, response: json({ error: 'artwork must be a string.' }, 400) };
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  if (trimmed.length > MAX_URL_LENGTH)
    return { ok: false, response: json({ error: 'artwork URL is too long.' }, 400) };
  try {
    new URL(trimmed);
  } catch {
    return { ok: false, response: json({ error: 'artwork must be a valid URL.' }, 400) };
  }
  return { ok: true, value: trimmed };
}

/** Validates tags: ensure string[], trim each, deduplicate */
export function validateTags(value: unknown): ValidationResult<string[]> {
  if (value === undefined || value === null) return { ok: true, value: [] };
  if (!Array.isArray(value))
    return { ok: false, response: json({ error: 'tags must be an array.' }, 400) };
  const trimmed = value
    .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    .map((t) => t.replace(/\s+/g, '-').trim());
  return { ok: true, value: [...new Set(trimmed)] };
}

/**
 * Validates an optional volume offset in dB.
 * Returns `undefined` when absent (PATCH skips it),
 * `null` when explicitly cleared,
 * the integer when valid (-12 to +12),
 * error Response when invalid.
 */
export function validateVolumeOffset(
  value: unknown
): { ok: true; value: number | null | undefined } | { ok: false; response: Response } {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null) return { ok: true, value: null };
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return {
      ok: false,
      response: json({ error: 'volumeOffset must be an integer.' }, 400),
    };
  }
  if (value < -12 || value > 12) {
    return {
      ok: false,
      response: json({ error: 'volumeOffset must be between -12 and +12.' }, 400),
    };
  }
  return { ok: true, value };
}

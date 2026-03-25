/**
 * Shared constants used across bot and API packages.
 * Consolidates magic numbers to ensure consistency.
 */

/**
 * Voice connection timeout in milliseconds.
 * How long to wait for a voice connection to become ready.
 */
export const VOICE_CONNECTION_TIMEOUT_MS = 5_000;

/**
 * Maximum length for a URL (applies to YouTube URLs and similar).
 */
export const MAX_URL_LENGTH = 2000;

/**
 * Maximum length for a playlist name.
 */
export const MAX_PLAYLIST_NAME_LENGTH = 200;

/**
 * Maximum length for a song nickname.
 */
export const MAX_NICKNAME_LENGTH = 50;

/**
 * Maximum number of videos to import from a playlist.
 */
export const MAX_PLAYLIST_VIDEOS = 100;

/**
 * Timeout for yt-dlp operations in milliseconds.
 */
export const YT_DLP_TIMEOUT_MS = 30_000;

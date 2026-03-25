/**
 * YouTube URL utility functions.
 * Shared across bot and API packages for consistent URL handling.
 */

/**
 * Generates a canonical YouTube watch URL for a given video ID.
 * @param videoId - The YouTube video ID
 * @returns A fully qualified YouTube watch URL
 * @example youTubeUrl('dQw4w9WgXcQ') // => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
 */
export function youTubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * Generates a YouTube thumbnail URL for a given video ID.
 * @param videoId - The YouTube video ID
 * @returns A fully qualified YouTube thumbnail URL (high quality)
 * @example youtubeThumbnail('dQw4w9WgXcQ') // => 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
 */
export function youtubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

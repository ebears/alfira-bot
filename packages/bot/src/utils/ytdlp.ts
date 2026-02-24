import { execFile } from 'child_process';

// ---------------------------------------------------------------------------
// Metadata returned from yt-dlp for a YouTube video.
// ---------------------------------------------------------------------------
export interface SongMetadata {
  title: string;
  youtubeId: string;
  duration: number; // seconds
  thumbnailUrl: string;
}

// ---------------------------------------------------------------------------
// getMetadata
//
// Fetches title, duration, and thumbnail for a YouTube URL by running:
//   yt-dlp --dump-json <url>
//
// --dump-json prints a JSON blob to stdout and exits without downloading
// anything. We use execFile (not exec) so the URL is passed as an argument
// rather than interpolated into a shell string — this prevents injection.
// ---------------------------------------------------------------------------
export function getMetadata(youtubeUrl: string): Promise<SongMetadata> {
  return new Promise((resolve, reject) => {
    execFile(
      'yt-dlp',
      ['--dump-json', '--no-playlist', youtubeUrl],
      { maxBuffer: 10 * 1024 * 1024 }, // 10 MB buffer — some JSON blobs are large
      (error, stdout) => {
        if (error) {
          return reject(
            new Error(`yt-dlp metadata fetch failed: ${error.message}`)
          );
        }

        try {
          const data = JSON.parse(stdout);
          resolve({
            title: data.title,
            youtubeId: data.id,
            duration: Math.round(data.duration ?? 0),
            thumbnailUrl: `https://img.youtube.com/vi/${data.id}/hqdefault.jpg`,
          });
        } catch {
          reject(new Error('yt-dlp returned invalid JSON'));
        }
      }
    );
  });
}

// ---------------------------------------------------------------------------
// getStreamUrl
//
// Asks yt-dlp for the direct CDN URL of the best available audio format,
// then returns that URL as a string without downloading anything.
//
// Previously we piped yt-dlp's stdout directly into FFmpeg, but YouTube's
// CDN throttles that connection inconsistently, causing the buffer to run
// dry and producing choppy audio every 30 seconds or so.
//
// By using -g instead, yt-dlp resolves and exits immediately. FFmpeg then
// opens its own direct HTTP connection to the CDN and manages buffering
// itself — which it handles far more reliably.
//
// Key flags:
//   -f bestaudio    Pick the best audio-only format available.
//   --no-playlist   Only process the first video if given a playlist URL.
//   -g              Print the direct media URL to stdout and exit.
// ---------------------------------------------------------------------------
export function getStreamUrl(youtubeUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'yt-dlp',
      ['-f', 'bestaudio', '--no-playlist', '-g', youtubeUrl],
      (error, stdout) => {
        if (error) {
          return reject(new Error(`yt-dlp stream URL fetch failed: ${error.message}`));
        }
        resolve(stdout.trim());
      }
    );
  });
}

// ---------------------------------------------------------------------------
// isValidYouTubeUrl
//
// A lightweight check before hitting yt-dlp. Catches obvious mistakes early
// without spawning a process. Not exhaustive — yt-dlp is the final arbiter.
// ---------------------------------------------------------------------------
export function isValidYouTubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const validHosts = ['youtube.com', 'www.youtube.com', 'youtu.be', 'music.youtube.com'];
    return validHosts.includes(parsed.hostname);
  } catch {
    return false;
  }
}

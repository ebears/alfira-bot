import { execFile, spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import type { Readable } from 'stream';

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
// Fetches title, duration, and id for a YouTube URL by running:
//   yt-dlp --print %(id)s --print %(duration)s --print %(title)s <url>
//
// --print outputs exactly one value per flag and exits without downloading
// anything — far cheaper than --dump-json, which fetches and serialises the
// entire format manifest (potentially several megabytes) just so we can
// discard all but three fields.
//
// id and duration are printed first so that the title, which may contain
// newlines in rare cases, can be reconstructed by joining everything from
// the third line onward.
//
// We use execFile (not exec) so the URL is passed as an argument rather than
// interpolated into a shell string — this prevents injection.
// ---------------------------------------------------------------------------
export function getMetadata(youtubeUrl: string): Promise<SongMetadata> {
  return new Promise((resolve, reject) => {
    execFile(
      'yt-dlp',
      [
        '--no-playlist',
        '--print', '%(id)s',
        '--print', '%(duration)s',
        '--print', '%(title)s',
        youtubeUrl,
      ],
      (error, stdout) => {
        if (error) {
          return reject(
            new Error(`yt-dlp metadata fetch failed: ${error.message}`)
          );
        }

        const lines = stdout.trimEnd().split('\n');
        if (lines.length < 3) {
          return reject(new Error('yt-dlp returned unexpected output'));
        }

        const id           = lines[0].trim();
        const durationStr  = lines[1].trim();
        const title        = lines.slice(2).join('\n'); // handles newlines in titles

        const duration = Math.round(parseFloat(durationStr) || 0);

        resolve({
          title,
          youtubeId: id,
          duration,
          thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
        });
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
// AudioStreamHandle
//
// Returned by createAudioStream so the caller can both read the audio data
// and kill the backing FFmpeg process when it's no longer needed (e.g. on
// skip or stop).
// ---------------------------------------------------------------------------
export interface AudioStreamHandle {
  /** OGG Opus stream encoded by FFmpeg at 96 kbps. */
  stream: Readable;
  /** Kill the underlying FFmpeg process. Safe to call more than once. */
  kill: () => void;
}

// ---------------------------------------------------------------------------
// createAudioStream
//
// Spawns FFmpeg with HTTP reconnect flags so that transient CDN drops do not
// silently terminate playback mid-track.
//
// Without reconnect flags, FFmpeg treats a dropped HTTP connection as EOF and
// exits cleanly — @discordjs/voice then sees the stream end, transitions the
// AudioPlayer to Idle, and onTrackEnd() fires as if the song finished
// normally. No error is thrown. This is the root cause of music stopping
// unexpectedly with no visible errors.
//
// Key FFmpeg flags:
//   -reconnect 1              Reconnect after a dropped connection.
//   -reconnect_streamed 1     Also reconnect for live/streamed sources.
//   -reconnect_delay_max 5    Cap reconnect back-off at 5 seconds.
//   -vn                       Discard any video stream.
//   -c:a libopus -b:a 96k     Encode to Opus at 96 kbps (same codec Discord
//                             uses natively — no quality loss from conversion).
//   -f ogg                    Wrap in an OGG container.
//
// The caller should use StreamType.OggOpus when passing the resulting stream
// to createAudioResource. prism-media will demux the OGG container and hand
// the Opus packets to Discord directly — no Node.js Opus encoder is required,
// which avoids the @discordjs/opus / opusscript dependency entirely.
// ---------------------------------------------------------------------------
export function createAudioStream(cdnUrl: string): AudioStreamHandle {
  const ffmpeg: ChildProcess = spawn(
    'ffmpeg',
    [
      '-reconnect',         '1',
      '-reconnect_streamed','1',
      '-reconnect_delay_max','5',
      '-i',                 cdnUrl,
      '-analyzeduration',   '0',
      '-loglevel',          'warning',
      '-vn',
      '-c:a',               'libopus',
      '-b:a',               '96k',
      '-f',                 'ogg',
      'pipe:1',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  // Surface FFmpeg warnings/errors in the bot console without letting them
  // propagate as unhandled stream errors.
  ffmpeg.stderr?.on('data', (chunk: Buffer) => {
    const msg = chunk.toString().trim();
    if (msg) console.warn('[FFmpeg]', msg);
  });

  ffmpeg.on('error', (err) => {
    console.error('[FFmpeg] process error:', err.message);
  });

  let killed = false;
  const kill = () => {
    if (!killed) {
      killed = true;
      ffmpeg.kill();
    }
  };

  return { stream: ffmpeg.stdout as Readable, kill };
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

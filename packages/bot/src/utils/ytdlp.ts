import { execFile, spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import type { Readable } from 'stream';
import { WriteStream as CapacitorWriteStream } from 'fs-capacitor';

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
// yt-dlp --print %(id)s --print %(duration)s --print %(title)s <url>
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
        '--print',
        '%(id)s',
        '--print',
        '%(duration)s',
        '--print',
        '%(title)s',
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

        const id = lines[0].trim();
        const durationStr = lines[1].trim();
        const title = lines.slice(2).join('\n'); // handles newlines in titles
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
// AudioStreamHandle
//
// Returned by createAudioStream so the caller can both read the audio data
// and kill the backing FFmpeg process when it's no longer needed (e.g. on
// skip or stop).
// ---------------------------------------------------------------------------
export interface AudioStreamHandle {
  /** WebM Opus stream (passthrough) or OGG Opus stream (re-encoded fallback). */
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
// Key FFmpeg input flags:
// -reconnect 1                   Reconnect after a dropped HTTP connection.
// -reconnect_streamed 1          Also reconnect for live/streamed (chunked) sources.
// -reconnect_on_network_error 1  Reconnect on lower-level network/TLS errors.
// -reconnect_delay_max 2         Cap reconnect back-off at 2 seconds.
// -analyzeduration 0             Disable input format probing (we know it's audio).
// -fpsprobesize 0                Disable frame rate probing (not needed for audio).
// -probesize 32                  Minimal probe size to speed up startup.
//
// Key FFmpeg output flags — two modes:
//
// isWebmOpus = true (default, ~99% of YouTube tracks):
//   YouTube's "bestaudio" is already a WebM container with an Opus stream at
//   ~160 kbps. FFmpeg remuxes (copies) the Opus packets directly into a new
//   WebM container — no decode/encode step, negligible CPU.
//   Use StreamType.WebmOpus in createAudioResource.
//
// isWebmOpus = false (fallback for M4A/MP4 sources):
//   Some age-restricted or region-locked videos only offer AAC in an M4A
//   container, which can't be put into WebM. FFmpeg re-encodes to Opus at
//   96 kbps inside an OGG container.
//   Use StreamType.OggOpus in createAudioResource.
//
// Node.js-side output buffer:
// FFmpeg's stdout is piped into an fs-capacitor WriteStream, which spills
// all incoming data to a temporary file on disk. A ReadStream created from
// the same capacitor is returned to the AudioPlayer.
//
// Why fs-capacitor instead of PassThrough:
//
// PassThrough is a back-pressure-coupled, in-memory pipe. The consumer
// (AudioPlayer) and producer (FFmpeg) are tightly coupled: if the consumer
// reads slowly, the in-memory buffer fills up and Node.js applies back-
// pressure to FFmpeg's stdout, preventing it from pre-filling the buffer
// ahead of time.
//
// fs-capacitor fully decouples the write side (FFmpeg) from the read side
// (AudioPlayer) by buffering to disk:
//
// 1. CDN reconnect gaps: FFmpeg pre-fills the temp file as fast as it can
//    (or just remuxes) — there is no back-pressure from the read side to
//    slow it down.
// 2. Silent choppiness: variable network throughput, encoding jitter, or
//    brief Node.js event-loop pauses cause irregular spacing between encoded
//    packets. Because the disk buffer is decoupled, these micro-gaps never
//    reach the AudioPlayer.
// 3. Unlimited buffer depth: unlike a fixed-size in-memory highWaterMark,
//    the disk buffer can grow as large as needed.
// ---------------------------------------------------------------------------
export function createAudioStream(cdnUrl: string, isWebmOpus = true): AudioStreamHandle {
  // Choose output flags based on whether the source is already WebM/Opus.
  const outputArgs = isWebmOpus
    ? ['-vn', '-c:a', 'copy', '-f', 'webm', 'pipe:1']
    : ['-vn', '-ar', '48000', '-ac', '2', '-c:a', 'libopus', '-b:a', '96k', '-f', 'ogg', 'pipe:1'];

  const ffmpeg: ChildProcess = spawn(
    'ffmpeg',
    [
      // ---- Input / HTTP options (must come before -i) ---------------------
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_on_network_error', '1',
      '-reconnect_delay_max', '2',
      '-analyzeduration', '0',
      '-probesize', '32',
      '-fpsprobesize', '0',
      '-i', cdnUrl,
      // ---- Output ---------------------------------------------------------
      ...outputArgs,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  // Pipe FFmpeg's encoded output into an fs-capacitor WriteStream. The
  // capacitor spills all data to a temp file on disk as it arrives, fully
  // decoupling the FFmpeg write side from the AudioPlayer read side.
  const capacitor = new CapacitorWriteStream();
  ffmpeg.stdout!.pipe(capacitor);

  // Surface FFmpeg warnings/errors in the bot console, filtering out benign
  // "Error parsing Opus packet header" messages that occur when the stream ends.
  // These are harmless and don't affect playback quality.
  const benignErrorPatterns = [
    /Error parsing Opus packet header/,
    /Invalid packet header/,
    /out#0\/webm.*muxing overhead/,   // WebM passthrough mode
    /out#0\/ogg.*muxing overhead/,    // OGG re-encode fallback mode
    /moov atom not found/,
  ];

  ffmpeg.stderr?.on('data', (chunk: Buffer) => {
    const msg = chunk.toString().trim();
    if (!msg) return;

    // Skip benign errors that occur at stream end
    const isBenign = benignErrorPatterns.some(pattern => pattern.test(msg));
    if (isBenign) return;

    console.warn('[FFmpeg]', msg);
  });

  // If the FFmpeg process itself fails to spawn or crashes at the OS level,
  // destroy the capacitor so the read stream ends and @discordjs/voice sees a
  // stream termination rather than the pipe silently hanging open.
  ffmpeg.on('error', (err) => {
    console.error('[FFmpeg] process error:', err.message);
    capacitor.destroy();
  });

  // Obtain a read stream from the capacitor. This stream reads from the temp
  // file, starting from the beginning of the buffered data, and will continue
  // to follow new writes until the capacitor is destroyed.
  const readStream = capacitor.createReadStream();

  let killed = false;
  const kill = () => {
    if (!killed) {
      killed = true;
      ffmpeg.kill();
      // Release the temp file. Any in-progress reads will receive an error,
      // which @discordjs/voice will surface as a stream end — acceptable
      // because kill() is only called on skip or stop.
      capacitor.destroy();
    }
  };

  return { stream: readStream, kill };
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

export function getStreamFormat(youtubeUrl: string): Promise<{ url: string; isWebmOpus: boolean }> {
  return new Promise((resolve, reject) => {
    execFile(
      'yt-dlp',
      [
        '-f', 'bestaudio[ext=webm]/bestaudio',
        '--no-playlist',
        '--print', '%(ext)s',    // line 0: container extension
        '--print', '%(urls)s',   // line 1: direct CDN URL (same as -g but via --print)
        youtubeUrl,
      ],
      (error, stdout) => {
        if (error) {
          return reject(new Error(`yt-dlp stream URL fetch failed: ${error.message}`));
        }
        const lines = stdout.trim().split('\n');
        const ext = lines[0].trim();
        const url = lines[1].trim();
        resolve({ url, isWebmOpus: ext === 'webm' });
      }
    );
  });
}

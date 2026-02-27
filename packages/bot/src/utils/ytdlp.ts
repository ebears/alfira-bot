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

        const id          = lines[0].trim();
        const durationStr = lines[1].trim();
        const title       = lines.slice(2).join('\n'); // handles newlines in titles

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
// Key FFmpeg input flags:
//   -reconnect 1                  Reconnect after a dropped HTTP connection.
//   -reconnect_streamed 1         Also reconnect for live/streamed (chunked)
//                                 sources.
//   -reconnect_on_network_error 1 Reconnect on lower-level network/TLS errors
//                                 (e.g. the "Error in the pull function" / IO
//                                 error messages logged in the console). Without
//                                 this flag, those failures are not retried.
//   -reconnect_delay_max 2        Cap reconnect back-off at 2 s (down from the
//                                 previous 5 s). A shorter cap means the gap
//                                 that must be covered by the Node.js-side
//                                 buffer is smaller.
//
// Key FFmpeg output / encoding flags:
//   -ar 48000                     Force 48 kHz sample rate. Opus requires
//                                 48 kHz input; being explicit avoids any
//                                 ambiguity about when FFmpeg resamples.
//   -ac 2                         Force stereo output. Discord renders stereo
//                                 and most music is stereo.
//   -application audio            Opus application mode tuned for general
//                                 audio/music (vs. "voip" or "lowdelay").
//   -vn                           Discard any video stream.
//   -c:a libopus -b:a 96k         Encode to Opus at 96 kbps — same codec
//                                 Discord uses natively, so no quality is lost
//                                 in a re-encode step on Discord's end.
//   -f ogg                        Wrap in an OGG container.
//
// Node.js-side output buffer:
//   FFmpeg's stdout is piped into an fs-capacitor WriteStream, which spills
//   all incoming data to a temporary file on disk. A ReadStream created from
//   the same capacitor is returned to the AudioPlayer.
//
//   Why fs-capacitor instead of PassThrough:
//
//   PassThrough is a back-pressure-coupled, in-memory pipe. The consumer
//   (AudioPlayer) and producer (FFmpeg) are tightly coupled: if the consumer
//   reads slowly, the in-memory buffer fills up and Node.js applies back-
//   pressure to FFmpeg's stdout, preventing it from pre-filling the buffer
//   ahead of time. When a CDN reconnect gap hits and FFmpeg stops producing
//   output for 0–2 seconds, the effective cushion left in the PassThrough is
//   often much smaller than the nominal 256 KB because back-pressure drained
//   it.
//
//   fs-capacitor fully decouples the write side (FFmpeg) from the read side
//   (AudioPlayer) by buffering to disk:
//
//   1. CDN reconnect gaps: FFmpeg pre-fills the temp file as fast as it can
//      encode — there is no back-pressure from the read side to slow it down.
//      The AudioPlayer reads from the temp file at its own pace, so the on-
//      disk buffer absorbs the entire reconnect gap with no audible stutter.
//
//   2. Silent choppiness: variable network throughput, encoding jitter, or
//      brief Node.js event-loop pauses cause irregular spacing between encoded
//      packets. Because the disk buffer is decoupled, these micro-gaps never
//      reach the AudioPlayer.
//
//   3. Unlimited buffer depth: unlike a fixed-size in-memory highWaterMark,
//      the disk buffer can grow as large as needed, which is particularly
//      useful for longer reconnect delays.
//
// The caller should use StreamType.OggOpus when passing the resulting stream
// to createAudioResource. prism-media will demux the OGG container and hand
// the Opus packets to Discord directly — no Node.js Opus encoder library
// (@discordjs/opus / opusscript) is required.
// ---------------------------------------------------------------------------
export function createAudioStream(cdnUrl: string): AudioStreamHandle {
  const ffmpeg: ChildProcess = spawn(
    'ffmpeg',
    [
      // ---- Input / HTTP options (must come before -i) ---------------------
      '-reconnect',                  '1',
      '-reconnect_streamed',         '1',
      '-reconnect_on_network_error', '1',
      '-reconnect_delay_max',        '2',
      '-i',                          cdnUrl,
      // ---- Demux / logging ------------------------------------------------
      '-analyzeduration',            '0',
      '-loglevel',                   'warning',
      // ---- Output encoding ------------------------------------------------
      '-vn',
      '-ar',                         '48000',
      '-ac',                         '2',
      '-c:a',                        'libopus',
      '-b:a',                        '96k',
      '-application',                'audio',
      '-f',                          'ogg',
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

  // If the FFmpeg process itself fails to spawn or crashes at the OS level,
  // destroy the capacitor so the read stream ends and @discordjs/voice sees a
  // stream termination rather than the pipe silently hanging open.
  ffmpeg.on('error', (err) => {
    console.error('[FFmpeg] process error:', err.message);
    capacitor.destroy();
  });

  // Pipe FFmpeg's encoded output into an fs-capacitor WriteStream. The
  // capacitor spills all data to a temp file on disk as it arrives, fully
  // decoupling the FFmpeg write side from the AudioPlayer read side. This
  // prevents back-pressure from limiting how far ahead FFmpeg can buffer,
  // and ensures CDN reconnect gaps or event-loop jitter are absorbed by the
  // on-disk buffer before they can reach the AudioPlayer.
  const capacitor = new CapacitorWriteStream();
  ffmpeg.stdout!.pipe(capacitor);

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

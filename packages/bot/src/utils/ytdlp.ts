import type { ChildProcess } from 'node:child_process';
import { execFile, spawn } from 'node:child_process';
import type { Readable } from 'node:stream';
import { logger } from '@alfira-bot/shared/logger';
import { WriteStream as CapacitorWriteStream } from 'fs-capacitor';

interface SongMetadata {
  title: string;
  youtubeId: string;
  duration: number; // seconds
  thumbnailUrl: string;
}

export interface PlaylistMetadata {
  title: string;
  playlistId: string;
  videoCount: number;
  videos: { id: string; title: string; duration: number; thumbnailUrl: string }[];
}

const YT_DLP_TIMEOUT_MS = 30_000;

// Filter benign FFmpeg stderr messages that occur at stream end.
const BENIGN_ERROR_PATTERNS = [
  /Error parsing Opus packet header/,
  /Invalid packet header/,
  /out#0\/webm.*muxing overhead/,
  /out#0\/ogg.*muxing overhead/,
  /moov atom not found/,
];

function execFileAsync(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: YT_DLP_TIMEOUT_MS }, (error, stdout) => {
      if (error) {
        return reject(error);
      }
      resolve(stdout);
    });
  });
}

/** Fetch video metadata via yt-dlp --print (no download). Uses execFile to prevent shell injection. */
export async function getMetadata(youtubeUrl: string): Promise<SongMetadata> {
  const stdout = await execFileAsync('yt-dlp', [
    '--no-playlist',
    '--print',
    '%(id)s',
    '--print',
    '%(duration)s',
    '--print',
    '%(title)s',
    youtubeUrl,
  ]);

  const lines = stdout.trimEnd().split('\n');
  if (lines.length < 3) {
    throw new Error('yt-dlp returned unexpected output');
  }

  const id = lines[0].trim();
  const durationStr = lines[1].trim();
  const title = lines.slice(2).join('\n'); // handles newlines in titles
  const duration = Math.round(parseFloat(durationStr) || 0);

  return {
    title,
    youtubeId: id,
    duration,
    thumbnailUrl: youtubeThumbnail(id),
  };
}

export interface AudioStreamHandle {
  stream: Readable;
  kill: () => void;
  isOutputWebmOpus: boolean;
}

/** Spawn FFmpeg with HTTP reconnect flags and fs-capacitor for disk-buffered decoupling. */
export function createAudioStream(
  cdnUrl: string,
  isWebmOpus = true,
  volumeOffset?: number | null
): AudioStreamHandle {
  // When a volume offset is set, stream copy is incompatible — must re-encode.
  const applyVolume = volumeOffset != null && volumeOffset !== 0;
  const actualIsWebmOpus = isWebmOpus && !applyVolume;

  const outputArgs = actualIsWebmOpus
    ? ['-vn', '-c:a', 'copy', '-f', 'webm', 'pipe:1']
    : [
        '-vn',
        '-ar',
        '48000',
        '-ac',
        '2',
        '-c:a',
        'libopus',
        '-b:a',
        '96k',
        ...(applyVolume ? ['-af', `volume=${volumeOffset}dB`] : []),
        '-f',
        actualIsWebmOpus ? 'webm' : 'ogg',
        'pipe:1',
      ];

  const ffmpeg: ChildProcess = spawn(
    'ffmpeg',
    [
      '-reconnect',
      '1',
      '-reconnect_streamed',
      '1',
      '-reconnect_on_network_error',
      '1',
      '-reconnect_delay_max',
      '2',
      '-analyzeduration',
      '0',
      '-probesize',
      '32',
      '-fpsprobesize',
      '0',
      '-i',
      cdnUrl,
      ...outputArgs,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  const capacitor = new CapacitorWriteStream();
  ffmpeg.stdout?.pipe(capacitor);

  ffmpeg.stderr?.on('data', (chunk: Buffer) => {
    const msg = chunk.toString().trim();
    if (!msg) return;
    if (BENIGN_ERROR_PATTERNS.some((pattern) => pattern.test(msg))) return;
    logger.warn({ source: 'FFmpeg' }, msg);
  });

  ffmpeg.on('error', (err) => {
    logger.error({ error: err.message, source: 'FFmpeg' }, 'FFmpeg process error');
    killed = true;
    ffmpeg.kill();
    capacitor.destroy();
  });

  const readStream = capacitor.createReadStream();

  let killed = false;
  const kill = () => {
    if (!killed) {
      killed = true;
      ffmpeg.kill();
      capacitor.destroy();
    }
  };

  return { stream: readStream, kill, isOutputWebmOpus: actualIsWebmOpus };
}

function youtubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'youtu.be', 'music.youtube.com'];

export function isValidYouTubeUrl(url: string): boolean {
  try {
    return YOUTUBE_HOSTS.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function isYouTubePlaylistUrl(url: string): boolean {
  if (!isValidYouTubeUrl(url)) return false;
  try {
    return new URL(url).searchParams.has('list');
  } catch {
    return false;
  }
}

export async function getPlaylistMetadataWithVideos(
  playlistUrl: string,
  maxVideos?: number
): Promise<PlaylistMetadata> {
  const range = `1:${maxVideos || 'inf'}`;

  const [metadataStdout, videosStdout] = await Promise.all([
    execFileAsync('yt-dlp', [
      '--flat-playlist',
      '-I',
      range,
      '--print',
      '%(playlist_title)s',
      '--print',
      '%(playlist_id)s',
      '--print',
      '%(playlist_count)s',
      playlistUrl,
    ]),
    execFileAsync('yt-dlp', ['--flat-playlist', '--dump-json', '-I', range, playlistUrl]),
  ]);

  const metaLines = metadataStdout.trimEnd().split('\n');
  if (metaLines.length < 3) {
    throw new Error('yt-dlp returned unexpected output for playlist');
  }

  const title = metaLines[0].trim();
  const playlistId = metaLines[1].trim();
  const videoCount = parseInt(metaLines[2].trim(), 10) || 0;

  const videos = videosStdout
    .trimEnd()
    .split('\n')
    .map((line, index) => {
      try {
        const data = JSON.parse(line);
        return {
          id: data.id || '',
          title: data.title || 'Unknown',
          duration: Math.round(data.duration) || 0,
          thumbnailUrl: youtubeThumbnail(data.id),
        };
      } catch {
        logger.warn(`Failed to parse video JSON at index ${index}, skipping`);
        return null;
      }
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  return {
    title,
    playlistId,
    videoCount,
    videos,
  };
}

export async function getStreamFormat(
  youtubeUrl: string
): Promise<{ url: string; isWebmOpus: boolean }> {
  let stdout: string;
  try {
    stdout = await execFileAsync('yt-dlp', [
      '-f',
      'bestaudio[ext=webm]/bestaudio',
      '--no-playlist',
      '--print',
      '%(ext)s', // line 0: container extension
      '--print',
      '%(urls)s', // line 1: direct CDN URL (same as -g but via --print)
      youtubeUrl,
    ]);
  } catch (error) {
    throw new Error(`Failed to get stream format for ${youtubeUrl}: ${error}`);
  }

  const lines = stdout.trim().split('\n');
  const ext = lines[0].trim();
  const url = lines[1].trim();

  return {
    url,
    isWebmOpus: ext === 'webm',
  };
}

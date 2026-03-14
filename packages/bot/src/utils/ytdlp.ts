import type { ChildProcess } from 'node:child_process';
import { execFile, spawn } from 'node:child_process';
import type { Readable } from 'node:stream';
import { WriteStream as CapacitorWriteStream } from 'fs-capacitor';

export interface SongMetadata {
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

function execFileAsync(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (error, stdout) => {
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
    thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
  };
}

export interface AudioStreamHandle {
  stream: Readable;
  kill: () => void;
}

/** Spawn FFmpeg with HTTP reconnect flags and fs-capacitor for disk-buffered decoupling. */
export function createAudioStream(cdnUrl: string, isWebmOpus = true): AudioStreamHandle {
  const outputArgs = isWebmOpus
    ? ['-vn', '-c:a', 'copy', '-f', 'webm', 'pipe:1']
    : ['-vn', '-ar', '48000', '-ac', '2', '-c:a', 'libopus', '-b:a', '96k', '-f', 'ogg', 'pipe:1'];

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

  // Filter benign FFmpeg stderr messages that occur at stream end.
  const benignErrorPatterns = [
    /Error parsing Opus packet header/,
    /Invalid packet header/,
    /out#0\/webm.*muxing overhead/,
    /out#0\/ogg.*muxing overhead/,
    /moov atom not found/,
  ];

  ffmpeg.stderr?.on('data', (chunk: Buffer) => {
    const msg = chunk.toString().trim();
    if (!msg) return;
    if (benignErrorPatterns.some((pattern) => pattern.test(msg))) return;
    console.warn('[FFmpeg]', msg);
  });

  ffmpeg.on('error', (err) => {
    console.error('[FFmpeg] process error:', err.message);
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

  return { stream: readStream, kill };
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
  try {
    const parsed = new URL(url);
    return YOUTUBE_HOSTS.includes(parsed.hostname) && parsed.searchParams.has('list');
  } catch {
    return false;
  }
}

async function getPlaylistMetadata(
  playlistUrl: string,
  maxVideos?: number
): Promise<PlaylistMetadata> {
  const args = [
    '--flat-playlist',
    '-I',
    `1:${maxVideos || 'inf'}`,
    '--print',
    '%(playlist_title)s',
    '--print',
    '%(playlist_id)s',
    '--print',
    '%(playlist_count)s',
    playlistUrl,
  ];

  const stdout = await execFileAsync('yt-dlp', args);

  const lines = stdout.trimEnd().split('\n');
  if (lines.length < 3) {
    throw new Error('yt-dlp returned unexpected output for playlist');
  }

  const title = lines[0].trim();
  const playlistId = lines[1].trim();
  const videoCount = parseInt(lines[2].trim(), 10) || 0;

  return {
    title,
    playlistId,
    videoCount,
    videos: [], // Will be fetched separately
  };
}

async function getPlaylistVideos(
  playlistUrl: string,
  maxVideos?: number
): Promise<PlaylistMetadata['videos']> {
  const args = ['--flat-playlist', '--dump-json', '-I', `1:${maxVideos || 'inf'}`, playlistUrl];

  const stdout = await execFileAsync('yt-dlp', args);

  const lines = stdout.trimEnd().split('\n');
  return lines
    .map((line) => {
      try {
        const data = JSON.parse(line);
        return {
          id: data.id || '',
          title: data.title || 'Unknown',
          duration: Math.round(data.duration) || 0,
          thumbnailUrl: `https://img.youtube.com/vi/${data.id}/hqdefault.jpg`,
        };
      } catch {
        return null;
      }
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);
}

export async function getPlaylistMetadataWithVideos(
  playlistUrl: string,
  maxVideos?: number
): Promise<PlaylistMetadata> {
  const [metadata, videos] = await Promise.all([
    getPlaylistMetadata(playlistUrl, maxVideos),
    getPlaylistVideos(playlistUrl, maxVideos),
  ]);

  return {
    ...metadata,
    videos,
  };
}

export async function getStreamFormat(
  youtubeUrl: string
): Promise<{ url: string; isWebmOpus: boolean }> {
  const stdout = await execFileAsync('yt-dlp', [
    '-f',
    'bestaudio[ext=webm]/bestaudio',
    '--no-playlist',
    '--print',
    '%(ext)s', // line 0: container extension
    '--print',
    '%(urls)s', // line 1: direct CDN URL (same as -g but via --print)
    youtubeUrl,
  ]);

  const lines = stdout.trim().split('\n');
  const ext = lines[0].trim();
  const url = lines[1].trim();

  return {
    url,
    isWebmOpus: ext === 'webm',
  };
}

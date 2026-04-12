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

const NODELINK_URL = process.env.NODELINK_URL ?? 'http://localhost:2333';
const NODELINK_AUTH = process.env.NODELINK_AUTHORIZATION ?? '';

function nodelinkHeaders(): { 'Content-Type': string; Authorization?: string } {
  const headers: { 'Content-Type': string; Authorization?: string } = {
    'Content-Type': 'application/json',
  };
  if (NODELINK_AUTH) {
    headers.Authorization = NODELINK_AUTH;
  }
  return headers;
}

async function restRequest<T>(path: string): Promise<T> {
  const url = `${NODELINK_URL}${path}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: nodelinkHeaders(),
  });

  if (!response.ok) {
    throw new Error(`NodeLink REST ${response.status}: ${await response.text()}`);
  }

  return response.json() as Promise<T>;
}

interface LoadTrackResponse {
  loadType?: string;
  data?: {
    encoded?: string;
    info?: {
      title?: string;
      identifier?: string;
      duration?: number;
      isStream?: boolean;
      isSeekable?: boolean;
      position?: number;
      author?: string;
      artworkUrl?: string;
    };
  };
  tracks?: { info?: { identifier?: string; title?: string; duration?: number } }[];
  playlistInfo?: { name?: string; selectedTrack?: number };
  exception?: { message?: string };
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

export async function getMetadata(youtubeUrl: string): Promise<SongMetadata> {
  const response = await restRequest<LoadTrackResponse>(
    `/v4/loadtracks?identifier=${encodeURIComponent(youtubeUrl)}`
  );

  if (response.loadType === 'error' || response.exception) {
    throw new Error(
      `NodeLink failed to load track: ${response.exception?.message ?? 'unknown error'}`
    );
  }

  const data = response.data;
  if (!data?.encoded || !data.info) {
    throw new Error('NodeLink returned no track data');
  }

  const info = data.info;
  const youtubeId = info.identifier ?? '';
  const title = info.title ?? 'Unknown';

  return {
    title,
    youtubeId,
    duration: info.duration ?? 0,
    thumbnailUrl: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
  };
}

export async function getStreamFormat(
  youtubeUrl: string
): Promise<{ track: string; isWebmOpus: boolean }> {
  const response = await restRequest<LoadTrackResponse>(
    `/v4/loadtracks?identifier=${encodeURIComponent(youtubeUrl)}`
  );

  if (response.loadType === 'error' || response.exception) {
    throw new Error(
      `NodeLink failed to load track: ${response.exception?.message ?? 'unknown error'}`
    );
  }

  const data = response.data;
  if (!data?.encoded) {
    throw new Error('NodeLink returned no track');
  }

  // NodeLink always provides Opus in Webm container via Lavalink-compatible protocol
  return { track: data.encoded, isWebmOpus: true };
}

export async function getPlaylistMetadataWithVideos(
  playlistUrl: string,
  maxVideos?: number
): Promise<PlaylistMetadata> {
  // NodeLink v4 uses /v4/loadtracks with YouTube playlist URL.
  // It returns a "playlist" loadType with track array.
  const response = await restRequest<LoadTrackResponse>(
    `/v4/loadtracks?identifier=${encodeURIComponent(playlistUrl)}`
  );

  if (response.loadType === 'error' || response.exception) {
    throw new Error(
      `NodeLink failed to load playlist: ${response.exception?.message ?? 'unknown error'}`
    );
  }

  const tracks = response.tracks ?? [];
  const limited = maxVideos ? tracks.slice(0, maxVideos) : tracks;

  const videos = limited.map((t) => {
    const id = t.info?.identifier ?? '';
    return {
      id,
      title: t.info?.title ?? 'Unknown',
      duration: t.info?.duration ?? 0,
      thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
    };
  });

  return {
    title: response.playlistInfo?.name ?? 'Unknown Playlist',
    playlistId: playlistUrl,
    videoCount: tracks.length,
    videos,
  };
}

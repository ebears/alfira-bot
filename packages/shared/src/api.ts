import type {
  LoopMode,
  Playlist,
  PlaylistDetail,
  QueueState,
  Song,
  User,
} from './types';

/**
 * Centralized API service layer for making HTTP requests.
 * Provides reusable functions for common API patterns.
 */

// Base API client - to be injected or configured externally
let apiClient: {
  get: <T>(url: string) => Promise<{ data: T }>;
  post: <T>(url: string, data?: any) => Promise<{ data: T }>;
  patch: <T>(url: string, data: any) => Promise<{ data: T }>;
  delete: <T>(url: string) => Promise<{ data: T }>;
} | null = null;

/**
 * Configure the API client to be used by all service functions
 */
export function configureApiClient(client: {
  get: <T>(url: string) => Promise<{ data: T }>;
  post: <T>(url: string, data?: any) => Promise<{ data: T }>;
  patch: <T>(url: string, data: any) => Promise<{ data: T }>;
  delete: <T>(url: string) => Promise<{ data: T }>;
}) {
  apiClient = client;
}

// ---------------------------------------------------------------------------
// Generic API Functions
// ---------------------------------------------------------------------------

/**
 * Generic GET request
 */
export async function get<T>(url: string): Promise<T> {
  if (!apiClient) {
    throw new Error('API client not configured. Call configureApiClient() first.');
  }
  const response = await apiClient.get<T>(url);
  return response.data;
}

/**
 * Generic POST request
 */
export async function post<T>(url: string, data?: any): Promise<T> {
  if (!apiClient) {
    throw new Error('API client not configured. Call configureApiClient() first.');
  }
  const response = await apiClient.post<T>(url, data);
  return response.data;
}

/**
 * Generic PATCH request
 */
export async function patch<T>(url: string, data: any): Promise<T> {
  if (!apiClient) {
    throw new Error('API client not configured. Call configureApiClient() first.');
  }
  const response = await apiClient.patch<T>(url, data);
  return response.data;
}

/**
 * Generic DELETE request
 */
export async function remove<T>(url: string): Promise<T> {
  if (!apiClient) {
    throw new Error('API client not configured. Call configureApiClient() first.');
  }
  const response = await apiClient.delete<T>(url);
  return response.data;
}

// ---------------------------------------------------------------------------
// Auth API Functions
// ---------------------------------------------------------------------------

export async function fetchMe(): Promise<User> {
  return get<{ user: User }>('/auth/me').then((r) => r.user);
}

export async function fetchLogout(): Promise<void> {
  return post('/auth/logout');
}

// ---------------------------------------------------------------------------
// Songs API Functions
// ---------------------------------------------------------------------------

export async function fetchSongs(): Promise<Song[]> {
  return get('/api/songs');
}

export async function createSong(youtubeUrl: string, nickname?: string): Promise<Song> {
  return post('/api/songs', { youtubeUrl, ...(nickname && { nickname }) });
}

export async function deleteSong(id: string): Promise<void> {
  return remove(`/api/songs/${id}`);
}

export async function updateSongNickname(id: string, nickname: string | null): Promise<Song> {
  return patch(`/api/songs/${id}`, { nickname });
}

// ---------------------------------------------------------------------------
// Playlists API Functions
// ---------------------------------------------------------------------------

export async function fetchPlaylists(adminView = false): Promise<Playlist[]> {
  const params = adminView ? '?adminView=true' : '';
  return get(`/api/playlists${params}`);
}

export async function createPlaylist(name: string): Promise<Playlist> {
  return post('/api/playlists', { name });
}

export async function fetchPlaylist(id: string, adminView = false): Promise<PlaylistDetail> {
  const params = adminView ? '?adminView=true' : '';
  return get(`/api/playlists/${id}${params}`);
}

export async function renamePlaylist(id: string, name: string): Promise<Playlist> {
  return patch(`/api/playlists/${id}`, { name });
}

export async function deletePlaylist(id: string): Promise<void> {
  return remove(`/api/playlists/${id}`);
}

export async function addSongToPlaylist(playlistId: string, songId: string): Promise<void> {
  return post(`/api/playlists/${playlistId}/songs`, { songId });
}

export async function removeSongFromPlaylist(playlistId: string, songId: string): Promise<void> {
  return remove(`/api/playlists/${playlistId}/songs/${songId}`);
}

export async function togglePlaylistVisibility(
  playlistId: string,
  isPrivate: boolean,
  adminView = false
): Promise<Playlist> {
  const params = adminView ? '?adminView=true' : '';
  return patch(`/api/playlists/${playlistId}/visibility${params}`, { isPrivate });
}

// ---------------------------------------------------------------------------
// Player API Functions
// ---------------------------------------------------------------------------

export async function fetchQueueState(): Promise<QueueState> {
  return get('/api/player/queue');
}

export async function startPlayback(opts: {
  playlistId?: string;
  mode: 'sequential' | 'random';
  loop: LoopMode;
  startFromSongId?: string;
}): Promise<void> {
  return post('/api/player/play', opts);
}

export async function skipTrack(): Promise<void> {
  return post('/api/player/skip');
}

export async function leaveVoice(): Promise<void> {
  return post('/api/player/leave');
}

export async function setLoopMode(mode: LoopMode): Promise<void> {
  return post('/api/player/loop', { mode });
}

export async function shuffleQueue(): Promise<void> {
  return post('/api/player/shuffle');
}

export async function unshuffleQueue(): Promise<void> {
  return post('/api/player/unshuffle');
}

export async function clearQueue(): Promise<void> {
  return post('/api/player/clear');
}

export async function togglePause(): Promise<{ isPaused: boolean }> {
  return post('/api/player/pause-toggle');
}

export async function quickAddToQueue(youtubeUrl: string): Promise<{
  message: string;
  song: {
    title: string;
    duration: number;
    thumbnailUrl: string;
    requestedBy: string;
  };
}> {
  return post('/api/player/quick-add', { youtubeUrl });
}

export async function quickAddPlaylistToQueue(
  youtubeUrl: string,
  maxVideos?: number
): Promise<{
  message: string;
  playlistTitle: string;
  totalVideos: number;
  queuedCount: number;
  songs: Array<{
    title: string;
    duration: number;
    thumbnailUrl: string;
    requestedBy: string;
  }>;
}> {
  return post('/api/player/quick-add-playlist', {
    youtubeUrl,
    ...(maxVideos && { maxVideos }),
  });
}

export async function addToPriorityQueue(songId: string): Promise<{
  message: string;
  song: {
    title: string;
    duration: number;
    thumbnailUrl: string;
    requestedBy: string;
  };
}> {
  return post('/api/player/add-to-priority', { songId });
}

export async function overridePlay(youtubeUrl: string): Promise<{
  message: string;
  song: {
    title: string;
    duration: number;
    thumbnailUrl: string;
    requestedBy: string;
  };
}> {
  return post('/api/player/override', { youtubeUrl });
}
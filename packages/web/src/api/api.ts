import type {
  LoopMode,
  Playlist,
  PlaylistDetail,
  QueueState,
  Song,
  User,
} from '@alfira-bot/shared';
import client from './client';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const getMe = () => client.get<{ user: User }>('/auth/me').then((r) => r.data.user);
export const logout = () => client.post('/auth/logout');
export const refresh = () => client.post<{ user: User }>('/auth/refresh').then((r) => r.data);

// ---------------------------------------------------------------------------
// Songs
// ---------------------------------------------------------------------------
export const getSongs = () => client.get<Song[]>('/api/songs').then((r) => r.data);
export const addSong = (youtubeUrl: string, nickname?: string) =>
  client
    .post<Song>('/api/songs', { youtubeUrl, ...(nickname && { nickname }) })
    .then((r) => r.data);
export const deleteSong = (id: string) => client.delete(`/api/songs/${id}`);

export interface ImportPlaylistResult {
  message: string;
  playlistTitle: string;
  totalVideos: number;
  importedCount: number;
  skippedCount: number;
  songs: Song[];
}

export const importPlaylist = (youtubeUrl: string, maxVideos?: number) =>
  client
    .post<ImportPlaylistResult>('/api/songs/import-playlist', {
      youtubeUrl,
      ...(maxVideos && { maxVideos }),
    })
    .then((r) => r.data);

// ---------------------------------------------------------------------------
// Playlists
// ---------------------------------------------------------------------------
export const getPlaylists = (adminView?: boolean) => {
  const params = adminView ? '?adminView=true' : '';
  return client.get<Playlist[]>(`/api/playlists${params}`).then((r) => r.data);
};
export const createPlaylist = (name: string) =>
  client.post<Playlist>('/api/playlists', { name }).then((r) => r.data);
export const getPlaylist = (id: string, adminView?: boolean) => {
  const params = adminView ? '?adminView=true' : '';
  return client.get<PlaylistDetail>(`/api/playlists/${id}${params}`).then((r) => r.data);
};
export const renamePlaylist = (id: string, name: string) =>
  client.patch<Playlist>(`/api/playlists/${id}`, { name }).then((r) => r.data);
export const deletePlaylist = (id: string) => client.delete(`/api/playlists/${id}`);
export const addSongToPlaylist = (playlistId: string, songId: string) =>
  client.post(`/api/playlists/${playlistId}/songs`, { songId });
export const removeSongFromPlaylist = (playlistId: string, songId: string) =>
  client.delete(`/api/playlists/${playlistId}/songs/${songId}`);
export const togglePlaylistVisibility = (
  playlistId: string,
  isPrivate: boolean,
  adminView?: boolean
) =>
  client
    .patch<Playlist>(`/api/playlists/${playlistId}/visibility`, { isPrivate, adminView })
    .then((r) => r.data);

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

interface QuickAddSong {
  title: string;
  duration: number;
  thumbnailUrl: string;
  requestedBy: string;
}

interface SongAddedResponse {
  message: string;
  song: QuickAddSong;
}

export const getQueueState = () => client.get<QueueState>('/api/player/queue').then((r) => r.data);
export const startPlayback = (opts: {
  playlistId?: string;
  mode: 'sequential' | 'random';
  loop: LoopMode;
  startFromSongId?: string;
}) => client.post('/api/player/play', opts);
export const skipTrack = () => client.post('/api/player/skip');
export const leaveVoice = () => client.post('/api/player/leave');

export const setLoopMode = (mode: LoopMode) => client.post('/api/player/loop', { mode });
export const shuffleQueue = () => client.post('/api/player/shuffle');
export const clearQueue = () => client.post('/api/player/clear');

export const togglePause = () =>
  client.post<{ isPaused: boolean }>('/api/player/pause-toggle').then((r) => r.data);

export const quickAddToQueue = (youtubeUrl: string) =>
  client.post<SongAddedResponse>('/api/player/quick-add', { youtubeUrl }).then((r) => r.data);

export interface QuickAddPlaylistResult {
  message: string;
  playlistTitle: string;
  totalVideos: number;
  queuedCount: number;
  songs: QuickAddSong[];
}

export const quickAddPlaylistToQueue = (youtubeUrl: string, maxVideos?: number) =>
  client
    .post<QuickAddPlaylistResult>('/api/player/quick-add-playlist', {
      youtubeUrl,
      ...(maxVideos && { maxVideos }),
    })
    .then((r) => r.data);

export const addToPriorityQueue = (songId: string) =>
  client.post<SongAddedResponse>('/api/player/add-to-priority', { songId }).then((r) => r.data);

export const overridePlay = (youtubeUrl: string) =>
  client.post<SongAddedResponse>('/api/player/override', { youtubeUrl }).then((r) => r.data);

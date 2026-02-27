import client from './client';
import type { Song, Playlist, PlaylistDetail, QueueState, LoopMode, User } from './types';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const getMe = () =>
  client.get<{ user: User }>('/auth/me').then((r) => r.data.user);

export const logout = () =>
  client.post('/auth/logout');

// ---------------------------------------------------------------------------
// Songs
// ---------------------------------------------------------------------------
export const getSongs = () =>
  client.get<Song[]>('/api/songs').then((r) => r.data);

export const addSong = (youtubeUrl: string) =>
  client.post<Song>('/api/songs', { youtubeUrl }).then((r) => r.data);

export const deleteSong = (id: string) =>
  client.delete(`/api/songs/${id}`);

// ---------------------------------------------------------------------------
// Playlists
// ---------------------------------------------------------------------------
export const getPlaylists = () =>
  client.get<Playlist[]>('/api/playlists').then((r) => r.data);

export const createPlaylist = (name: string) =>
  client.post<Playlist>('/api/playlists', { name }).then((r) => r.data);

export const getPlaylist = (id: string) =>
  client.get<PlaylistDetail>(`/api/playlists/${id}`).then((r) => r.data);

export const renamePlaylist = (id: string, name: string) =>
  client.patch<Playlist>(`/api/playlists/${id}`, { name }).then((r) => r.data);

export const deletePlaylist = (id: string) =>
  client.delete(`/api/playlists/${id}`);

export const addSongToPlaylist = (playlistId: string, songId: string) =>
  client.post(`/api/playlists/${playlistId}/songs`, { songId });

export const removeSongFromPlaylist = (playlistId: string, songId: string) =>
  client.delete(`/api/playlists/${playlistId}/songs/${songId}`);

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------
export const getQueueState = () =>
  client.get<QueueState>('/api/player/queue').then((r) => r.data);

export const startPlayback = (opts: {
  playlistId?: string;
  mode: 'sequential' | 'random';
  loop: LoopMode;
  startFromSongId?: string;
}) => client.post('/api/player/play', opts);

export const skipTrack = () => client.post('/api/player/skip');
export const stopPlayback = () => client.post('/api/player/stop');
export const setLoopMode = (mode: LoopMode) => client.post('/api/player/loop', { mode });
export const shuffleQueue = () => client.post('/api/player/shuffle');

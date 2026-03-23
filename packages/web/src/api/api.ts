import type {
  LoopMode,
  Playlist,
  PlaylistDetail,
  QueueState,
  Song,
  User,
} from '@alfira-bot/shared';
import {
  configureApiClient,
  getMe as sharedGetMe,
  logout as sharedLogout,
} from '@alfira-bot/shared/api';
import client from './client';

// Configure the shared API service with the web client
configureApiClient(client);

// Re-export the shared API functions with web-specific typing
export const getMe = sharedGetMe;
export const logout = sharedLogout;

// ---------------------------------------------------------------------------
// Songs
// ---------------------------------------------------------------------------

import {
  createSong as sharedCreateSong,
  deleteSong as sharedDeleteSong,
  fetchSongs as sharedFetchSongs,
  importPlaylist as sharedImportPlaylist,
  updateSongNickname as sharedUpdateSongNickname,
} from '@alfira-bot/shared/api';

export const getSongs = sharedFetchSongs;
export const addSong = sharedCreateSong;
export const deleteSong = sharedDeleteSong;
export const updateSongNickname = sharedUpdateSongNickname;
export const importPlaylist = sharedImportPlaylist;

// ---------------------------------------------------------------------------
// Playlists
// ---------------------------------------------------------------------------

import {
  addSongToPlaylist as sharedAddSongToPlaylist,
  createPlaylist as sharedCreatePlaylist,
  deletePlaylist as sharedDeletePlaylist,
  fetchPlaylist as sharedFetchPlaylist,
  fetchPlaylists as sharedFetchPlaylists,
  removeSongFromPlaylist as sharedRemoveSongFromPlaylist,
  renamePlaylist as sharedRenamePlaylist,
  togglePlaylistVisibility as sharedTogglePlaylistVisibility,
} from '@alfira-bot/shared/api';

export const getPlaylists = sharedFetchPlaylists;
export const createPlaylist = sharedCreatePlaylist;
export const getPlaylist = sharedFetchPlaylist;
export const renamePlaylist = sharedRenamePlaylist;
export const deletePlaylist = sharedDeletePlaylist;
export const addSongToPlaylist = sharedAddSongToPlaylist;
export const removeSongFromPlaylist = sharedRemoveSongFromPlaylist;
export const togglePlaylistVisibility = sharedTogglePlaylistVisibility;

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

import {
  addToPriorityQueue as sharedAddToPriorityQueue,
  clearQueue as sharedClearQueue,
  fetchQueueState as sharedFetchQueueState,
  leaveVoice as sharedLeaveVoice,
  overridePlay as sharedOverridePlay,
  quickAddPlaylistToQueue as sharedQuickAddPlaylistToQueue,
  quickAddToQueue as sharedQuickAddToQueue,
  setLoopMode as sharedSetLoopMode,
  shuffleQueue as sharedShuffleQueue,
  skipTrack as sharedSkipTrack,
  startPlayback as sharedStartPlayback,
  togglePause as sharedTogglePause,
  unshuffleQueue as sharedUnshuffleQueue,
} from '@alfira-bot/shared/api';

export const getQueueState = sharedFetchQueueState;
export const startPlayback = sharedStartPlayback;
export const skipTrack = sharedSkipTrack;
export const leaveVoice = sharedLeaveVoice;
export const setLoopMode = sharedSetLoopMode;
export const shuffleQueue = sharedShuffleQueue;
export const unshuffleQueue = sharedUnshuffleQueue;
export const clearQueue = sharedClearQueue;
export const togglePause = sharedTogglePause;
export const quickAddToQueue = sharedQuickAddToQueue;
export const quickAddPlaylistToQueue = sharedQuickAddPlaylistToQueue;
export const addToPriorityQueue = sharedAddToPriorityQueue;
export const overridePlay = sharedOverridePlay;

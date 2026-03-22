import type {
  LoopMode,
  Playlist,
  PlaylistDetail,
  QueueState,
  Song,
  User,
} from '@alfira-bot/shared';
import { configureApiClient, getMe as sharedGetMe, logout as sharedLogout } from '../../shared/src/api';
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
  fetchSongs as sharedFetchSongs,
  createSong as sharedCreateSong,
  deleteSong as sharedDeleteSong,
  updateSongNickname as sharedUpdateSongNickname,
  importPlaylist as sharedImportPlaylist,
} from '../../shared/src/api';

export const getSongs = sharedFetchSongs;
export const addSong = sharedCreateSong;
export const deleteSong = sharedDeleteSong;
export const updateSongNickname = sharedUpdateSongNickname;
export const importPlaylist = sharedImportPlaylist;

// ---------------------------------------------------------------------------
// Playlists
// ---------------------------------------------------------------------------
import {
  fetchPlaylists as sharedFetchPlaylists,
  createPlaylist as sharedCreatePlaylist,
  fetchPlaylist as sharedFetchPlaylist,
  renamePlaylist as sharedRenamePlaylist,
  deletePlaylist as sharedDeletePlaylist,
  addSongToPlaylist as sharedAddSongToPlaylist,
  removeSongFromPlaylist as sharedRemoveSongFromPlaylist,
  togglePlaylistVisibility as sharedTogglePlaylistVisibility,
} from '../../shared/src/api';

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
  fetchQueueState as sharedFetchQueueState,
  startPlayback as sharedStartPlayback,
  skipTrack as sharedSkipTrack,
  leaveVoice as sharedLeaveVoice,
  setLoopMode as sharedSetLoopMode,
  shuffleQueue as sharedShuffleQueue,
  unshuffleQueue as sharedUnshuffleQueue,
  clearQueue as sharedClearQueue,
  togglePause as sharedTogglePause,
  quickAddToQueue as sharedQuickAddToQueue,
  quickAddPlaylistToQueue as sharedQuickAddPlaylistToQueue,
  addToPriorityQueue as sharedAddToPriorityQueue,
  overridePlay as sharedOverridePlay,
} from '../../shared/src/api';

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

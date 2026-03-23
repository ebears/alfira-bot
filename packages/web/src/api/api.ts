import { configureApiClient } from '@alfira-bot/shared/api';
import client from './client';

// Configure the shared API service with the web client
configureApiClient(client);

// ---------------------------------------------------------------------------
// Re-export everything from shared API with web-compatible names
// ---------------------------------------------------------------------------
export {
  // Auth
  fetchMe as getMe,
  fetchLogout as logout,

  // Songs
  fetchSongs as getSongs,
  createSong as addSong,
  deleteSong,
  updateSongNickname,
  importPlaylist,

  // Playlists
  fetchPlaylists as getPlaylists,
  createPlaylist,
  fetchPlaylist as getPlaylist,
  renamePlaylist,
  deletePlaylist,
  addSongToPlaylist,
  removeSongFromPlaylist,
  togglePlaylistVisibility,

  // Player
  fetchQueueState,
  startPlayback,
  skipTrack,
  leaveVoice,
  setLoopMode,
  shuffleQueue,
  unshuffleQueue,
  clearQueue,
  togglePause,
  quickAddToQueue,
  quickAddPlaylistToQueue,
  addToPriorityQueue,
  overridePlay,
} from '@alfira-bot/shared/api';

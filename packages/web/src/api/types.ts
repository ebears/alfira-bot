// ---------------------------------------------------------------------------
// Types mirroring packages/shared/src/types.ts
// The web package doesn't import from shared to keep the build simple.
// ---------------------------------------------------------------------------

export interface Song {
  id: string;
  title: string;
  youtubeUrl: string;
  youtubeId: string;
  duration: number;
  thumbnailUrl: string;
  addedBy: string;
  nickname?: string | null;
  createdAt: string;
}

export interface Playlist {
  id: string;
  name: string;
  createdBy: string;
  createdByDisplayName?: string;
  isPrivate: boolean;
  createdAt: string;
  _count?: { songs: number };
}

export interface PlaylistSong {
  id: string;
  playlistId: string;
  songId: string;
  position: number;
  song: Song;
}

export interface PlaylistDetail extends Playlist {
  songs: PlaylistSong[];
}

export type LoopMode = 'off' | 'song' | 'queue';

export interface QueuedSong extends Song {
  requestedBy: string;
}

export interface QueueState {
  isPlaying: boolean;
  isPaused: boolean;
  loopMode: LoopMode;
  currentSong: QueuedSong | null;
  priorityQueue: QueuedSong[]; // Songs added via Quick Add or "Add to Queue" - play before regular queue
  queue: QueuedSong[];
  trackStartedAt: number | null;
}

export interface User {
  discordId: string;
  username: string;
  avatar: string | null;
  isAdmin: boolean;
}

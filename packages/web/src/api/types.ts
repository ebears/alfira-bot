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
  createdAt: string;
}

export interface Playlist {
  id: string;
  name: string;
  createdBy: string;
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
  loopMode: LoopMode;
  currentSong: QueuedSong | null;
  queue: QueuedSong[];
}

export interface User {
  discordId: string;
  username: string;
  avatar: string | null;
  isAdmin: boolean;
}

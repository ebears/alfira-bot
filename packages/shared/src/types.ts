// ---------------------------------------------------------------------------
// @discord-music-bot/shared — types
//
// This is the single source of truth for types that cross package boundaries.
// Both the bot and the API import from here. Never duplicate these types.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Song
//
// Matches the database schema exactly. This is what the API returns and what
// Prisma queries produce. It does NOT include queue-time properties like
// requestedBy — use QueuedSong for that.
// ---------------------------------------------------------------------------
export interface Song {
  id: string;
  title: string;
  youtubeUrl: string;
  youtubeId: string;
  duration: number;       // seconds
  thumbnailUrl: string;
  addedBy: string;        // Discord user ID
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// QueuedSong
//
// A Song that has been placed into the GuildPlayer's queue. Extends Song with
// requestedBy (the display name of the Discord member who queued it), which
// is a runtime property that is never persisted to the database.
// ---------------------------------------------------------------------------
export interface QueuedSong extends Song {
  requestedBy: string;
}

// ---------------------------------------------------------------------------
// LoopMode
//
// off   — Queue plays through once, then stops.
// song  — Current song repeats until explicitly skipped.
// queue — When the last song finishes the queue resets and replays.
// ---------------------------------------------------------------------------
export type LoopMode = 'off' | 'song' | 'queue';

// ---------------------------------------------------------------------------
// QueueState
//
// A snapshot of the GuildPlayer's current state. This is the payload for
// GET /api/player/queue and the Socket.io player:update event (Phase 8).
// ---------------------------------------------------------------------------
export interface QueueState {
  isPlaying: boolean;
  isPaused: boolean;
  loopMode: LoopMode;
  currentSong: QueuedSong | null;
  queue: QueuedSong[];
}

// ---------------------------------------------------------------------------
// Playlist / PlaylistSong
//
// Match the database schema. _count is added by Prisma when using the
// include: { _count: { select: { songs: true } } } query option.
// ---------------------------------------------------------------------------
export interface Playlist {
  id: string;
  name: string;
  createdBy: string;
  createdAt: Date;
  songs?: PlaylistSong[];
  _count?: { songs: number };
}

export interface PlaylistSong {
  id: string;
  playlistId: string;
  songId: string;
  position: number;
  song?: Song;
}

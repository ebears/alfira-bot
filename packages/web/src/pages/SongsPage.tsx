import type { Playlist, Song } from '@alfira-bot/shared';
import { ListPlus, ListVideo, Loader2, Play, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addSong,
  addSongToPlaylist,
  addToPriorityQueue,
  deleteSong,
  getPlaylists,
  getSongs,
  importPlaylist,
  startPlayback,
} from '../api/api';
import { useAdminView } from '../context/AdminViewContext';
import { usePlayer } from '../context/PlayerContext';
import { useNotification } from '../hooks/useNotification';
import { useSocket } from '../hooks/useSocket';

export default function SongsPage() {
  const { isAdminView } = useAdminView();
  const socket = useSocket();
  const { state: queueState } = usePlayer();
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const { notification, notify } = useNotification();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([getSongs(), getPlaylists()]);
      setSongs(s);
      setPlaylists(p);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handleSongAdded = (song: Song) => {
      setSongs((prev) => {
        if (prev.some((s) => s.id === song.id)) return prev;
        return [song, ...prev];
      });
    };

    const handleSongDeleted = (id: string) => {
      setSongs((prev) => prev.filter((s) => s.id !== id));
    };

    socket.on('songs:added', handleSongAdded);
    socket.on('songs:deleted', handleSongDeleted);

    return () => {
      socket.off('songs:added', handleSongAdded);
      socket.off('songs:deleted', handleSongDeleted);
    };
  }, [socket]);

  const handleDelete = async (id: string) => {
    await deleteSong(id);
    setDeleteId(null);
    // Socket event will update the songs list
  };

  const filtered = songs.filter((s) => s.title.toLowerCase().includes(search.toLowerCase()));

  // ---------------------------------------------------------------------------
  // Play from song — replaces the queue with the full library starting from
  // the clicked song, then continues sequentially through the rest.
  // ---------------------------------------------------------------------------

  const handlePlayFromSong = async (songId: string) => {
    setPlayingId(songId);
    try {
      await startPlayback({
        mode: 'sequential',
        loop: queueState.loopMode,
        startFromSongId: songId,
      });
      notify('Started playback', 'success');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      const errorMsg =
        e?.response?.data?.error ?? 'Could not start playback. Is the bot in a voice channel?';
      notify(errorMsg, 'error', 5000);
    } finally {
      setPlayingId(null);
    }
  };

  const handleAddToQueue = async (songId: string) => {
    try {
      await addToPriorityQueue(songId);
      notify('Added to Up Next', 'success');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      const errorMsg =
        e?.response?.data?.error ?? 'Could not add to queue. Is the bot in a voice channel?';
      notify(errorMsg, 'error', 5000);
    }
  };

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="font-display text-4xl md:text-5xl text-fg tracking-wider">Library</h1>
          <p className="font-mono text-xs text-muted mt-1">
            {loading ? '—' : `${songs.length} track${songs.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {isAdminView && (
          <button type="button" className="btn-primary" onClick={() => setShowAddModal(true)}>
            + Add Song
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-4 md:mb-6">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-faint w-4 h-4 md:w-3.5 md:h-3.5"
          size={16}
        />
        <input
          className="input pl-10"
          placeholder="Search by title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Grid */}
      {loading ? (
        <SkeletonGrid />
      ) : filtered.length === 0 ? (
        <EmptyState search={search} isAdmin={isAdminView} onAdd={() => setShowAddModal(true)} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3 md:gap-4">
          {filtered.map((song, i) => (
            <SongCard
              key={song.id}
              song={song}
              isAdmin={isAdminView}
              playlists={playlists}
              style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
              onDelete={() => setDeleteId(song.id)}
              onAddedToPlaylist={() => {
                /* optimistic — no refresh needed */
              }}
              onPlay={() => handlePlayFromSong(song.id)}
              isPlaying={playingId === song.id}
              onAddToQueue={() => handleAddToQueue(song.id)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddSongModal
          onClose={() => setShowAddModal(false)}
          onAdded={(song) => {
            setSongs((prev) => {
              if (prev.some((s) => s.id === song.id)) return prev;
              return [song, ...prev];
            });
            setShowAddModal(false);
          }}
        />
      )}

      {deleteId &&
        (() => {
          const songToDelete = songs.find((s) => s.id === deleteId);
          return songToDelete ? (
            <ConfirmDeleteModal
              song={songToDelete}
              onConfirm={() => handleDelete(deleteId)}
              onCancel={() => setDeleteId(null)}
            />
          ) : null;
        })()}

      {/* Notification Toast */}
      {notification && (
        <div
          className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg font-mono text-xs animate-fade-up ${
            notification.type === 'success'
              ? 'bg-accent/20 border border-accent/40 text-accent'
              : 'bg-danger/20 border border-danger/40 text-danger'
          }`}
        >
          {notification.message}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Song card
// ---------------------------------------------------------------------------
function SongCard({
  song,
  isAdmin,
  playlists,
  style,
  onDelete,
  onAddedToPlaylist,
  onPlay,
  isPlaying,
  onAddToQueue,
}: {
  song: Song;
  isAdmin: boolean;
  playlists: Playlist[];
  style?: React.CSSProperties;
  onDelete: () => void;
  onAddedToPlaylist: () => void;
  onPlay: () => void;
  isPlaying: boolean;
  onAddToQueue: () => void;
}) {
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [addingToPlaylist, setAddingToPlaylist] = useState<string | null>(null);
  const [addedTo, setAddedTo] = useState<Set<string>>(new Set());
  const [addingToQueue, setAddingToQueue] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close playlist menu when clicking outside
  useEffect(() => {
    if (!showPlaylistMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowPlaylistMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPlaylistMenu]);

  const handleAddToPlaylist = async (playlistId: string) => {
    setAddingToPlaylist(playlistId);
    try {
      await addSongToPlaylist(playlistId, song.id);
      setAddedTo((prev) => new Set([...prev, playlistId]));
      onAddedToPlaylist();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      if (error?.response?.data?.error?.includes('already')) {
        setAddedTo((prev) => new Set([...prev, playlistId]));
      }
    } finally {
      setAddingToPlaylist(null);
    }
  };

  const handleAddToQueue = async () => {
    setAddingToQueue(true);
    try {
      await onAddToQueue();
    } finally {
      setAddingToQueue(false);
    }
  };

  return (
    <div
      className="card group animate-fade-up opacity-0 flex flex-col hover:border-border/80 hover:bg-elevated transition-colors duration-150"
      style={style}
    >
      {/* Thumbnail with play overlay */}
      <div className="relative aspect-video bg-elevated overflow-hidden">
        <img
          src={song.thumbnailUrl}
          alt={song.nickname || song.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
        <span className="absolute bottom-2 right-2 font-mono text-[10px] text-white/80 bg-black/50 px-1.5 py-0.5 rounded">
          {formatDuration(song.duration)}
        </span>

        {/* Play button overlay — visible on hover or while loading */}
        <button
          type="button"
          onClick={onPlay}
          disabled={isPlaying}
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
            isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 md:opacity-0'
          } disabled:cursor-default`}
          title="Play from this song"
        >
          <div
            className={`w-14 h-14 md:w-12 md:h-12 rounded-full bg-black/60 border border-white/20 backdrop-blur-sm flex items-center justify-center shadow-xl transition-transform duration-150 ${
              isPlaying ? 'scale-100' : 'scale-90 group-hover:scale-100'
            }`}
          >
            {isPlaying ? (
              <Loader2 size={24} className="text-accent animate-spin md:w-5 md:h-5" />
            ) : (
              <Play size={24} className="text-white md:w-5 md:h-5" />
            )}
          </div>
        </button>
      </div>

      {/* Info */}
      <div className="p-3 flex-1 flex flex-col gap-2">
        <p className="font-body font-semibold text-sm text-fg leading-tight line-clamp-2">
          {song.nickname || song.title}
        </p>
        <div className="flex gap-1.5 mt-auto pt-1">
          {/* Add to Queue - available to all members */}
          <button
            type="button"
            onClick={handleAddToQueue}
            disabled={addingToQueue}
            className="flex items-center justify-center w-11 h-11 md:w-8 md:h-8 text-muted hover:text-accent active:bg-accent/10 border border-border hover:border-accent/30 rounded-lg md:rounded transition-colors duration-150 disabled:opacity-50"
            title="Add to Up Next"
          >
            {addingToQueue ? (
              <span className="w-4 h-4 md:w-3 md:h-3 border-2 md:border border-accent border-t-transparent rounded-full animate-spin inline-block" />
            ) : (
              <ListVideo size={18} className="md:w-4 md:h-4" />
            )}
          </button>
          {isAdmin && (
            <>
              {/* Add to playlist */}
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setShowPlaylistMenu((p) => !p)}
                  className="flex items-center justify-center w-11 h-11 md:w-8 md:h-8 text-muted hover:text-fg active:bg-elevated border border-border hover:border-accent/30 rounded-lg md:rounded transition-colors duration-150"
                  title="Add to playlist"
                >
                  <ListPlus size={18} className="md:w-4 md:h-4" />
                </button>
                {showPlaylistMenu && (
                  <div className="absolute bottom-full left-0 mb-1 w-44 bg-elevated border border-border rounded shadow-xl z-20 overflow-hidden">
                    {playlists.length === 0 ? (
                      <p className="px-3 py-2 text-xs font-mono text-muted">no playlists yet</p>
                    ) : (
                      playlists.map((pl) => (
                        <button
                          type="button"
                          key={pl.id}
                          disabled={addingToPlaylist === pl.id || addedTo.has(pl.id)}
                          onClick={() => handleAddToPlaylist(pl.id)}
                          className="w-full text-left px-3 py-2 text-xs font-body text-fg hover:bg-border/50 transition-colors duration-100 disabled:opacity-50 flex items-center justify-between"
                        >
                          <span className="truncate">{pl.name}</span>
                          {addedTo.has(pl.id) && (
                            <span className="text-accent text-[10px] ml-1">✓</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {/* Delete */}
              <button
                type="button"
                onClick={onDelete}
                className="flex items-center justify-center w-11 h-11 md:w-8 md:h-8 text-faint hover:text-danger active:bg-danger/10 border border-border hover:border-danger/30 rounded-lg md:rounded transition-colors duration-150"
                title="Delete song"
              >
                <Trash2 size={18} className="md:w-4 md:h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Song modal
// ---------------------------------------------------------------------------
function AddSongModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (song: Song) => void;
}) {
  const [url, setUrl] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isPlaylist, setIsPlaylist] = useState(false);
  const [importFullPlaylist, setImportFullPlaylist] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Detect playlist URLs
  useEffect(() => {
    const hasListParam = url.includes('list=');
    setIsPlaylist(hasListParam);
    if (!hasListParam) {
      setImportFullPlaylist(false);
    }
  }, [url]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      if (importFullPlaylist) {
        // Import playlist
        const result = await importPlaylist(url.trim());
        setSuccessMsg(result.message);
        // Close modal after a short delay to show success message
        // The socket events will update the song list automatically
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        // Add single song
        const song = await addSong(url.trim(), nickname.trim() || undefined);
        onAdded(song);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error?.response?.data?.error ?? 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') onClose();
  };

  return (
    <Backdrop onClose={onClose}>
      <div className="bg-surface border border-border rounded-xl p-5 md:p-6 w-full max-w-md mx-4 shadow-2xl animate-fade-up">
        <h2 className="font-display text-2xl md:text-3xl text-fg tracking-wider mb-1">Add Song</h2>
        <p className="font-mono text-xs text-muted mb-4 md:mb-6">paste a youtube url</p>

        <input
          ref={inputRef}
          className="input mb-3"
          placeholder="https://youtube.com/watch?v=..."
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError('');
            setSuccessMsg('');
          }}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />

        {isPlaylist && (
          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={importFullPlaylist}
              onChange={(e) => setImportFullPlaylist(e.target.checked)}
              disabled={loading}
              className="w-4 h-4 rounded border-border bg-surface accent-accent"
            />
            <span className="font-mono text-xs text-fg">Import full playlist</span>
          </label>
        )}

        {!importFullPlaylist && (
          <input
            className="input mb-3"
            placeholder="Nickname (optional)"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            disabled={loading}
          />
        )}

        {error && <p className="font-mono text-xs text-danger mb-3">{error}</p>}

        {successMsg && <p className="font-mono text-xs text-success mb-3">{successMsg}</p>}

        {loading && (
          <p className="font-mono text-xs text-muted mb-3 flex items-center gap-2">
            <span className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin inline-block" />
            {importFullPlaylist ? 'importing playlist...' : 'fetching metadata...'}
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSubmit}
            disabled={loading || !url.trim()}
          >
            {importFullPlaylist ? 'Import' : 'Add'}
          </button>
        </div>
      </div>
    </Backdrop>
  );
}

// ---------------------------------------------------------------------------
// Delete confirm modal
// ---------------------------------------------------------------------------
function ConfirmDeleteModal({
  song,
  onConfirm,
  onCancel,
}: {
  song: Song;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Backdrop onClose={onCancel}>
      <div className="bg-surface border border-border rounded-xl p-5 md:p-6 w-full max-w-sm mx-4 shadow-2xl animate-fade-up">
        <h2 className="font-display text-2xl md:text-3xl text-fg tracking-wider mb-1">
          Delete Song
        </h2>
        <p className="font-body text-sm text-muted mb-2">
          Remove <span className="text-fg font-semibold">"{song.nickname || song.title}"</span> from
          the library?
        </p>
        <p className="font-mono text-xs text-danger/70 mb-4 md:mb-6">
          this will remove it from all playlists too.
        </p>
        <div className="flex gap-2 justify-end">
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn-danger border-danger/50" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </Backdrop>
  );
}

// ---------------------------------------------------------------------------
// Shared backdrop
// ---------------------------------------------------------------------------
function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loading grid
// ---------------------------------------------------------------------------
function SkeletonGrid() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="card">
          <div className="skeleton aspect-video" />
          <div className="p-3 space-y-2">
            <div className="skeleton h-3 w-3/4" />
            <div className="skeleton h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyState({
  search,
  isAdmin,
  onAdd,
}: {
  search: string;
  isAdmin: boolean;
  onAdd: () => void;
}) {
  if (search) {
    return (
      <div className="text-center py-24">
        <p className="font-display text-4xl text-faint tracking-wider mb-2">No Results</p>
        <p className="font-mono text-xs text-faint">no songs match "{search}"</p>
      </div>
    );
  }

  return (
    <div className="text-center py-24">
      <p className="font-display text-4xl text-faint tracking-wider mb-2">Empty Library</p>
      {isAdmin ? (
        <p className="font-mono text-xs text-faint">
          <button type="button" className="text-accent hover:underline" onClick={onAdd}>
            add the first song
          </button>{' '}
          to get started
        </p>
      ) : (
        <p className="font-mono text-xs text-faint">no songs have been added yet</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers / icons
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

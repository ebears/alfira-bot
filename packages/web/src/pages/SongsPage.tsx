import { useState, useEffect, useRef, useCallback } from 'react';
import { getSongs, addSong, deleteSong, getPlaylists, addSongToPlaylist } from '../api/api';
import type { Song, Playlist } from '../api/types';
import { useAuth } from '../context/AuthContext';

export default function SongsPage() {
  const { user } = useAuth();
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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

  useEffect(() => { load(); }, [load]);

  const filtered = songs.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    await deleteSong(id);
    setSongs((prev) => prev.filter((s) => s.id !== id));
    setDeleteId(null);
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-5xl text-fg tracking-wider">Library</h1>
          <p className="font-mono text-xs text-muted mt-1">
            {loading ? '—' : `${songs.length} track${songs.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {user?.isAdmin && (
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            + Add Song
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" size={15} />
        <input
          className="input pl-9"
          placeholder="Search by title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Grid */}
      {loading ? (
        <SkeletonGrid />
      ) : filtered.length === 0 ? (
        <EmptyState search={search} isAdmin={user?.isAdmin ?? false} onAdd={() => setShowAddModal(true)} />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
          {filtered.map((song, i) => (
            <SongCard
              key={song.id}
              song={song}
              isAdmin={user?.isAdmin ?? false}
              playlists={playlists}
              style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
              onDelete={() => setDeleteId(song.id)}
              onAddedToPlaylist={() => {/* optimistic — no refresh needed */}}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddSongModal
          onClose={() => setShowAddModal(false)}
          onAdded={(song) => {
            setSongs((prev) => [song, ...prev]);
            setShowAddModal(false);
          }}
        />
      )}
      {deleteId && (
        <ConfirmDeleteModal
          song={songs.find((s) => s.id === deleteId)!}
          onConfirm={() => handleDelete(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
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
}: {
  song: Song;
  isAdmin: boolean;
  playlists: Playlist[];
  style?: React.CSSProperties;
  onDelete: () => void;
  onAddedToPlaylist: () => void;
}) {
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [addingToPlaylist, setAddingToPlaylist] = useState<string | null>(null);
  const [addedTo, setAddedTo] = useState<Set<string>>(new Set());
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

  return (
    <div
      className="card group animate-fade-up opacity-0 flex flex-col hover:border-border/80
                 hover:bg-elevated transition-colors duration-150"
      style={style}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-elevated overflow-hidden">
        <img
          src={song.thumbnailUrl}
          alt={song.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <span className="absolute bottom-2 right-2 font-mono text-[10px] text-white/80 bg-black/50 px-1.5 py-0.5 rounded">
          {formatDuration(song.duration)}
        </span>
      </div>

      {/* Info */}
      <div className="p-3 flex-1 flex flex-col gap-2">
        <p className="font-body font-semibold text-sm text-fg leading-tight line-clamp-2">
          {song.title}
        </p>

        {isAdmin && (
          <div className="flex gap-1.5 mt-auto pt-1">
            {/* Add to playlist */}
            <div className="relative flex-1" ref={menuRef}>
              <button
                onClick={() => setShowPlaylistMenu((p) => !p)}
                className="w-full text-xs font-mono text-muted hover:text-fg border border-border
                           hover:border-accent/30 rounded px-2 py-1 transition-colors duration-150"
              >
                + playlist
              </button>
              {showPlaylistMenu && (
                <div className="absolute bottom-full left-0 mb-1 w-44 bg-elevated border border-border
                                rounded shadow-xl z-20 overflow-hidden">
                  {playlists.length === 0 ? (
                    <p className="px-3 py-2 text-xs font-mono text-muted">no playlists yet</p>
                  ) : (
                    playlists.map((pl) => (
                      <button
                        key={pl.id}
                        disabled={addingToPlaylist === pl.id || addedTo.has(pl.id)}
                        onClick={() => handleAddToPlaylist(pl.id)}
                        className="w-full text-left px-3 py-2 text-xs font-body text-fg
                                   hover:bg-border/50 transition-colors duration-100
                                   disabled:opacity-50 flex items-center justify-between"
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
              onClick={onDelete}
              className="text-xs font-mono text-faint hover:text-danger border border-border
                         hover:border-danger/30 rounded px-2 py-1 transition-colors duration-150"
              title="Delete song"
            >
              del
            </button>
          </div>
        )}
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    try {
      const song = await addSong(url.trim());
      onAdded(song);
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
      <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-md shadow-2xl animate-fade-up">
        <h2 className="font-display text-3xl text-fg tracking-wider mb-1">Add Song</h2>
        <p className="font-mono text-xs text-muted mb-6">paste a youtube url</p>

        <input
          ref={inputRef}
          className="input mb-3"
          placeholder="https://youtube.com/watch?v=..."
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(''); }}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />

        {error && (
          <p className="font-mono text-xs text-danger mb-3">{error}</p>
        )}

        {loading && (
          <p className="font-mono text-xs text-muted mb-3 flex items-center gap-2">
            <span className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin inline-block" />
            fetching metadata...
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <button className="btn-ghost" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSubmit} disabled={loading || !url.trim()}>
            Add
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
      <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl animate-fade-up">
        <h2 className="font-display text-3xl text-fg tracking-wider mb-1">Delete Song</h2>
        <p className="font-body text-sm text-muted mb-2">
          Remove <span className="text-fg font-semibold">"{song.title}"</span> from the library?
        </p>
        <p className="font-mono text-xs text-danger/70 mb-6">
          this will remove it from all playlists too.
        </p>
        <div className="flex gap-2 justify-end">
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn-danger border-danger/50" onClick={onConfirm}>Delete</button>
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
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
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
          <button className="text-accent hover:underline" onClick={onAdd}>
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

function SearchIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

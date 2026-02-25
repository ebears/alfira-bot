import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getPlaylist, renamePlaylist, removeSongFromPlaylist,
  addSongToPlaylist, getSongs, startPlayback, deletePlaylist,
} from '../api/api';
import type { PlaylistDetail, Song, LoopMode } from '../api/types';
import { useAuth } from '../context/AuthContext';

export default function PlaylistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [showAddSongs, setShowAddSongs] = useState(false);
  const [showPlay, setShowPlay] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const pl = await getPlaylist(id);
      setPlaylist(pl);
      setNameValue(pl.name);
    } catch {
      navigate('/playlists', { replace: true });
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus();
  }, [editingName]);

  const handleRename = async () => {
    if (!playlist || !nameValue.trim() || nameValue.trim() === playlist.name) {
      setEditingName(false);
      setNameValue(playlist?.name ?? '');
      return;
    }
    const updated = await renamePlaylist(playlist.id, nameValue.trim());
    setPlaylist((p) => p ? { ...p, name: updated.name } : p);
    setEditingName(false);
  };

  const handleRemoveSong = async (songId: string) => {
    if (!playlist) return;
    await removeSongFromPlaylist(playlist.id, songId);
    setPlaylist((p) => p ? {
      ...p,
      songs: p.songs.filter((ps) => ps.songId !== songId),
    } : p);
    setRemoveId(null);
  };

  const handleDeletePlaylist = async () => {
    if (!playlist) return;
    await deletePlaylist(playlist.id);
    navigate('/playlists');
  };

  if (loading) return <DetailSkeleton />;
  if (!playlist) return null;

  return (
    <div className="p-8">
      {/* Back */}
      <button
        onClick={() => navigate('/playlists')}
        className="flex items-center gap-1.5 font-mono text-xs text-muted hover:text-fg
                   transition-colors duration-150 mb-6"
      >
        <ChevronLeftIcon size={14} /> playlists
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div className="flex-1 min-w-0">
          {editingName && user?.isAdmin ? (
            <input
              ref={nameInputRef}
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') { setEditingName(false); setNameValue(playlist.name); }
              }}
              className="font-display text-5xl bg-transparent text-fg tracking-wider
                         border-b-2 border-accent outline-none w-full"
              style={{ fontSize: '3rem', lineHeight: 1 }}
            />
          ) : (
            <h1
              className={`font-display text-5xl text-fg tracking-wider ${
                user?.isAdmin ? 'cursor-pointer hover:text-accent/90 transition-colors duration-150' : ''
              }`}
              onClick={() => user?.isAdmin && setEditingName(true)}
              title={user?.isAdmin ? 'Click to rename' : undefined}
            >
              {playlist.name}
            </h1>
          )}
          <p className="font-mono text-xs text-muted mt-1">
            {playlist.songs.length} {playlist.songs.length === 1 ? 'track' : 'tracks'}
          </p>
        </div>

        {user?.isAdmin && (
          <div className="flex gap-2 flex-shrink-0">
            <button className="btn-ghost text-xs" onClick={() => setShowAddSongs(true)}>
              + Add Songs
            </button>
            <button
              className="btn-primary text-xs"
              onClick={() => setShowPlay(true)}
              disabled={playlist.songs.length === 0}
            >
              ▶ Play
            </button>
            <button
              className="btn-danger text-xs"
              onClick={handleDeletePlaylist}
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Song list */}
      {playlist.songs.length === 0 ? (
        <EmptyState isAdmin={user?.isAdmin ?? false} onAdd={() => setShowAddSongs(true)} />
      ) : (
        <div className="space-y-1">
          {playlist.songs.map((ps, i) => (
            <SongRow
              key={ps.id}
              position={i + 1}
              song={ps.song}
              isAdmin={user?.isAdmin ?? false}
              onRemove={() => setRemoveId(ps.songId)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showAddSongs && (
        <AddSongsModal
          playlist={playlist}
          onClose={() => setShowAddSongs(false)}
          onAdded={() => { load(); setShowAddSongs(false); }}
        />
      )}
      {showPlay && (
        <PlayModal
          playlistId={playlist.id}
          onClose={() => setShowPlay(false)}
        />
      )}
      {removeId && (
        <ConfirmRemoveModal
          song={playlist.songs.find((ps) => ps.songId === removeId)!.song}
          onConfirm={() => handleRemoveSong(removeId)}
          onCancel={() => setRemoveId(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Song row
// ---------------------------------------------------------------------------
function SongRow({
  position,
  song,
  isAdmin,
  onRemove,
}: {
  position: number;
  song: Song;
  isAdmin: boolean;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-lg group
                    hover:bg-elevated transition-colors duration-100">
      <span className="font-mono text-xs text-faint w-6 text-right flex-shrink-0">
        {position}
      </span>
      <img
        src={song.thumbnailUrl}
        alt={song.title}
        className="w-10 h-7 object-cover rounded border border-border flex-shrink-0"
        loading="lazy"
      />
      <div className="flex-1 min-w-0">
        <p className="font-body text-sm font-medium text-fg truncate">{song.title}</p>
      </div>
      <span className="font-mono text-xs text-muted flex-shrink-0">
        {formatDuration(song.duration)}
      </span>
      {isAdmin && (
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 font-mono text-xs text-faint
                     hover:text-danger transition-all duration-150 px-2 py-1"
          title="Remove from playlist"
        >
          rem
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Songs modal — shows full library, lets admin pick songs to add
// ---------------------------------------------------------------------------
function AddSongsModal({
  playlist,
  onClose,
  onAdded,
}: {
  playlist: PlaylistDetail;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Set<string>>(
    new Set(playlist.songs.map((ps) => ps.songId))
  );
  const [search, setSearch] = useState('');

  useEffect(() => {
    getSongs().then((s) => { setAllSongs(s); setLoading(false); });
  }, []);

  const filtered = allSongs.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async (song: Song) => {
    setAdding((prev) => new Set([...prev, song.id]));
    try {
      await addSongToPlaylist(playlist.id, song.id);
      setAdded((prev) => new Set([...prev, song.id]));
    } catch {
      /* already added — mark as added */
      setAdded((prev) => new Set([...prev, song.id]));
    } finally {
      setAdding((prev) => { const n = new Set(prev); n.delete(song.id); return n; });
    }
  };

  const hasAddedNew = added.size > playlist.songs.length;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-lg shadow-2xl
                      flex flex-col max-h-[80vh] animate-fade-up">
        <div className="p-5 border-b border-border">
          <h2 className="font-display text-3xl text-fg tracking-wider">Add Songs</h2>
          <p className="font-mono text-xs text-muted mt-0.5">to "{playlist.name}"</p>
          <input
            autoFocus
            className="input mt-4"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="skeleton w-10 h-7 rounded" />
                  <div className="skeleton h-3 flex-1" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-6 font-mono text-xs text-muted text-center">no songs found</p>
          ) : (
            filtered.map((song) => {
              const isAdded = added.has(song.id);
              const isAdding = adding.has(song.id);
              return (
                <div key={song.id} className="flex items-center gap-3 px-5 py-3
                                               hover:bg-elevated transition-colors duration-100">
                  <img
                    src={song.thumbnailUrl}
                    alt={song.title}
                    className="w-10 h-7 object-cover rounded border border-border flex-shrink-0"
                    loading="lazy"
                  />
                  <span className="flex-1 font-body text-sm text-fg truncate">{song.title}</span>
                  <span className="font-mono text-xs text-muted">{formatDuration(song.duration)}</span>
                  <button
                    disabled={isAdded || isAdding}
                    onClick={() => handleAdd(song)}
                    className={`font-mono text-xs px-3 py-1 rounded border transition-colors duration-150 ${
                      isAdded
                        ? 'border-accent/30 text-accent bg-accent/5 cursor-default'
                        : 'border-border text-muted hover:border-accent/40 hover:text-accent'
                    }`}
                  >
                    {isAdding ? '...' : isAdded ? '✓' : 'add'}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-border flex justify-end">
          <button className="btn-primary" onClick={hasAddedNew ? onAdded : onClose}>
            {hasAddedNew ? 'Done' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Play modal — mode and loop options
// ---------------------------------------------------------------------------
function PlayModal({
  playlistId,
  onClose,
}: {
  playlistId: string;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'sequential' | 'random'>('sequential');
  const [loop, setLoop] = useState<LoopMode>('off');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePlay = async () => {
    setLoading(true);
    setError('');
    try {
      await startPlayback({ playlistId, mode, loop });
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e?.response?.data?.error ?? 'Could not start playback. Is the bot in a voice channel?');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl animate-fade-up">
        <h2 className="font-display text-3xl text-fg tracking-wider mb-1">Play Playlist</h2>
        <p className="font-mono text-xs text-muted mb-6">configure playback</p>

        <div className="space-y-4 mb-6">
          <div>
            <p className="font-mono text-xs text-muted mb-2 uppercase tracking-widest">Order</p>
            <div className="flex gap-2">
              {(['sequential', 'random'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2 text-xs font-mono rounded border transition-colors duration-150 ${
                    mode === m
                      ? 'bg-accent/10 border-accent/40 text-accent'
                      : 'border-border text-muted hover:border-muted'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="font-mono text-xs text-muted mb-2 uppercase tracking-widest">Loop</p>
            <div className="flex gap-2">
              {(['off', 'song', 'queue'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLoop(l)}
                  className={`flex-1 py-2 text-xs font-mono rounded border transition-colors duration-150 ${
                    loop === l
                      ? 'bg-accent/10 border-accent/40 text-accent'
                      : 'border-border text-muted hover:border-muted'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="font-mono text-xs text-danger mb-4">{error}</p>}

        <div className="flex gap-2 justify-end">
          <button className="btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn-primary" onClick={handlePlay} disabled={loading}>
            {loading ? 'Starting...' : '▶ Play'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirm remove from playlist
// ---------------------------------------------------------------------------
function ConfirmRemoveModal({
  song,
  onConfirm,
  onCancel,
}: {
  song: Song;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl animate-fade-up">
        <h2 className="font-display text-3xl text-fg tracking-wider mb-1">Remove Song</h2>
        <p className="font-body text-sm text-muted mb-6">
          Remove <span className="text-fg font-semibold">"{song.title}"</span> from this playlist?
          The song won't be deleted from the library.
        </p>
        <div className="flex gap-2 justify-end">
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn-danger border-danger/50" onClick={onConfirm}>Remove</button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton / empty state
// ---------------------------------------------------------------------------
function DetailSkeleton() {
  return (
    <div className="p-8">
      <div className="skeleton h-3 w-20 mb-6 rounded" />
      <div className="skeleton h-12 w-64 mb-2 rounded" />
      <div className="skeleton h-3 w-24 mb-8 rounded" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-3">
          <div className="skeleton w-6 h-3 rounded" />
          <div className="skeleton w-10 h-7 rounded" />
          <div className="skeleton h-3 flex-1 rounded" />
          <div className="skeleton h-3 w-12 rounded" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ isAdmin, onAdd }: { isAdmin: boolean; onAdd: () => void }) {
  return (
    <div className="text-center py-24">
      <p className="font-display text-4xl text-faint tracking-wider mb-2">Empty Playlist</p>
      {isAdmin ? (
        <p className="font-mono text-xs text-faint">
          <button className="text-accent hover:underline" onClick={onAdd}>
            add some songs
          </button>{' '}
          to get started
        </p>
      ) : (
        <p className="font-mono text-xs text-faint">no songs in this playlist yet</p>
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

function ChevronLeftIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

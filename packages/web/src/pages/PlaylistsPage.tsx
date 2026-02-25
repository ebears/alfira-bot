import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPlaylists, createPlaylist, deletePlaylist } from '../api/api';
import type { Playlist } from '../api/types';
import { useAuth } from '../context/AuthContext';

export default function PlaylistsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Playlist | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPlaylists(await getPlaylists());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (name: string) => {
    const pl = await createPlaylist(name);
    setPlaylists((prev) => [...prev, pl]);
    setShowCreate(false);
  };

  const handleDelete = async (pl: Playlist) => {
    await deletePlaylist(pl.id);
    setPlaylists((prev) => prev.filter((p) => p.id !== pl.id));
    setDeleteTarget(null);
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-5xl text-fg tracking-wider">Playlists</h1>
          <p className="font-mono text-xs text-muted mt-1">
            {loading ? '—' : `${playlists.length} playlist${playlists.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {user?.isAdmin && (
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            + New Playlist
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <SkeletonList />
      ) : playlists.length === 0 ? (
        <EmptyState isAdmin={user?.isAdmin ?? false} onCreate={() => setShowCreate(true)} />
      ) : (
        <div className="grid gap-3">
          {playlists.map((pl, i) => (
            <PlaylistRow
              key={pl.id}
              playlist={pl}
              isAdmin={user?.isAdmin ?? false}
              style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
              onClick={() => navigate(`/playlists/${pl.id}`)}
              onDelete={(e) => { e.stopPropagation(); setDeleteTarget(pl); }}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreatePlaylistModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}
      {deleteTarget && (
        <ConfirmDeleteModal
          playlist={deleteTarget}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Playlist row
// ---------------------------------------------------------------------------
function PlaylistRow({
  playlist,
  isAdmin,
  style,
  onClick,
  onDelete,
}: {
  playlist: Playlist;
  isAdmin: boolean;
  style?: React.CSSProperties;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const count = playlist._count?.songs ?? 0;

  return (
    <div
      className="card flex items-center gap-4 px-5 py-4 cursor-pointer group
                 hover:bg-elevated hover:border-border/80 transition-colors duration-150
                 animate-fade-up opacity-0"
      style={style}
      onClick={onClick}
    >
      {/* Icon */}
      <div className="w-10 h-10 rounded bg-accent/10 border border-accent/20 flex-shrink-0
                      flex items-center justify-center">
        <ListIcon size={16} className="text-accent" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-body font-semibold text-fg group-hover:text-accent transition-colors duration-150">
          {playlist.name}
        </p>
        <p className="font-mono text-xs text-muted mt-0.5">
          {count} {count === 1 ? 'song' : 'songs'}
        </p>
      </div>

      {/* Admin actions */}
      {isAdmin && (
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 font-mono text-xs text-faint
                     hover:text-danger transition-all duration-150 px-2 py-1"
          title="Delete playlist"
        >
          del
        </button>
      )}

      {/* Arrow */}
      <ChevronIcon size={16} className="text-faint group-hover:text-muted transition-colors duration-150" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create playlist modal
// ---------------------------------------------------------------------------
function CreatePlaylistModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      await onCreate(name.trim());
    } catch {
      setError('Could not create playlist. Try again.');
      setLoading(false);
    }
  };

  return (
    <Backdrop onClose={onClose}>
      <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl animate-fade-up">
        <h2 className="font-display text-3xl text-fg tracking-wider mb-1">New Playlist</h2>
        <p className="font-mono text-xs text-muted mb-6">choose a name</p>
        <input
          autoFocus
          className="input mb-3"
          placeholder="My Playlist"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') onClose(); }}
          disabled={loading}
        />
        {error && <p className="font-mono text-xs text-danger mb-3">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button className="btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={loading || !name.trim()}>
            Create
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
  playlist,
  onConfirm,
  onCancel,
}: {
  playlist: Playlist;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Backdrop onClose={onCancel}>
      <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl animate-fade-up">
        <h2 className="font-display text-3xl text-fg tracking-wider mb-1">Delete Playlist</h2>
        <p className="font-body text-sm text-muted mb-6">
          Delete <span className="text-fg font-semibold">"{playlist.name}"</span>?
          Songs in the library won't be affected.
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
// Skeleton / empty state
// ---------------------------------------------------------------------------
function SkeletonList() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card flex items-center gap-4 px-5 py-4">
          <div className="skeleton w-10 h-10 rounded" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-48" />
            <div className="skeleton h-2.5 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ isAdmin, onCreate }: { isAdmin: boolean; onCreate: () => void }) {
  return (
    <div className="text-center py-24">
      <p className="font-display text-4xl text-faint tracking-wider mb-2">No Playlists</p>
      {isAdmin ? (
        <p className="font-mono text-xs text-faint">
          <button className="text-accent hover:underline" onClick={onCreate}>
            create the first playlist
          </button>
        </p>
      ) : (
        <p className="font-mono text-xs text-faint">no playlists have been created yet</p>
      )}
    </div>
  );
}

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

function ListIcon({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function ChevronIcon({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

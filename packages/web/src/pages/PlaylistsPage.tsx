import type { Playlist } from '@alfira-bot/shared';
import { CaretRightIcon, GhostIcon, PlaylistIcon } from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPlaylist, deletePlaylist, getPlaylists } from '../api/api';
import { Backdrop } from '../components/Backdrop';
import ConfirmModal from '../components/ConfirmModal';
import { useAdminView } from '../context/AdminViewContext';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';

export default function PlaylistsPage() {
  const { isAdminView } = useAdminView();
  const { user } = useAuth();
  const navigate = useNavigate();
  const socket = useSocket();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Playlist | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPlaylists(await getPlaylists(isAdminView));
    } finally {
      setLoading(false);
    }
  }, [isAdminView]);

  useEffect(() => {
    load();
  }, [load]);

  // ---------------------------------------------------------------------------
  // Real-time socket wiring
  //
  // playlists:updated covers four mutations: create, rename, song added, song
  // removed. The payload is always a full Playlist object with _count.songs.
  //
  // Strategy: upsert by id.
  //   - If the playlist is already in the list, replace it (handles renames and
  //     song count changes).
  //   - If it's not in the list yet, append it (handles newly created playlists
  //     from another session).
  //
  // There is no playlists:deleted socket event — the server emits 204 with no
  // payload. Deleted playlists will disappear on the next natural page load or
  // navigation. This matches the behaviour described in the API route comments.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handlePlaylistUpdated = (updated: Playlist) => {
      setPlaylists((prev) => {
        const exists = prev.some((p) => p.id === updated.id);
        if (exists) {
          return prev.map((p) => (p.id === updated.id ? updated : p));
        }
        return [...prev, updated];
      });
    };

    socket.on('playlists:updated', handlePlaylistUpdated);

    return () => {
      socket.off('playlists:updated', handlePlaylistUpdated);
    };
  }, [socket]);

  const handleCreate = async (name: string) => {
    const pl = await createPlaylist(name);
    // The socket event will also fire and upsert, but we do an optimistic
    // update here too so the creating user sees it instantly without waiting
    // for the round-trip.
    setPlaylists((prev) => {
      if (prev.some((p) => p.id === pl.id)) return prev;
      return [...prev, pl];
    });
    setShowCreate(false);
  };

  const handleDelete = async (pl: Playlist) => {
    await deletePlaylist(pl.id);
    setPlaylists((prev) => prev.filter((p) => p.id !== pl.id));
    setDeleteTarget(null);
  };

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="font-display text-4xl md:text-5xl text-fg tracking-wider">Playlists</h1>
          <p className="font-mono text-xs text-muted mt-1">
            {loading ? '—' : `${playlists.length} playlist${playlists.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setShowCreate(true)}>
          + New Playlist
        </button>
      </div>

      {/* List */}
      {loading ? (
        <SkeletonList />
      ) : playlists.length === 0 ? (
        <EmptyState isAdmin={isAdminView} onCreate={() => setShowCreate(true)} />
      ) : (
        <div className="grid gap-2 md:gap-3">
          {playlists.map((pl, i) => (
            <PlaylistRow
              key={pl.id}
              playlist={pl}
              isAdmin={isAdminView}
              isOwner={user?.discordId === pl.createdBy}
              style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
              onClick={() => navigate(`/playlists/${pl.id}`)}
              onDelete={(e) => {
                e.stopPropagation();
                setDeleteTarget(pl);
              }}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreatePlaylistModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />
      )}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Playlist"
          message={
            <>
              Delete <span className="text-fg font-semibold">"{deleteTarget.name}"</span>? Songs in
              the library won't be affected.
            </>
          }
          confirmLabel="Delete"
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
  isOwner,
  style,
  onClick,
  onDelete,
}: {
  playlist: Playlist;
  isAdmin: boolean;
  isOwner: boolean;
  style?: React.CSSProperties;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const count = playlist._count?.songs ?? 0;
  return (
    <div
      className="card flex items-center gap-3 md:gap-4 px-4 md:px-5 py-3.5 md:py-4 cursor-pointer group hover:bg-elevated active:bg-elevated/80 hover:border-border/80 transition-colors duration-150 animate-fade-up opacity-0"
      style={style}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
    >
      {/* Icon */}
      <div className="w-11 h-11 md:w-10 md:h-10 rounded-xl bg-accent/10 border border-accent/20 shrink-0 flex items-center justify-center">
        <PlaylistIcon size={18} weight="duotone" className="text-accent md:w-4 md:h-4" />
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-body font-semibold text-fg group-hover:text-accent transition-colors duration-150">
            {playlist.name}
          </p>
          {playlist.isPrivate && (
            <span className="text-muted" title="Private playlist">
              <GhostIcon size={14} weight="duotone" />
            </span>
          )}
        </div>
        <p className="font-mono text-xs text-muted mt-0.5">
          {count} {count === 1 ? 'song' : 'songs'}
        </p>
      </div>
      {/* Admin/Owner actions */}
      {(isAdmin || isOwner) && (
        <button
          type="button"
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 md:opacity-0 font-mono text-xs text-faint hover:text-danger active:text-danger transition-all duration-150 px-3 py-2.5 md:px-2 md:py-1 min-h-11 md:min-h-0"
          title="Delete playlist"
        >
          del
        </button>
      )}
      {/* Arrow */}
      <CaretRightIcon
        size={18}
        weight="duotone"
        className="text-faint group-hover:text-muted transition-colors duration-150 md:w-4 md:h-4"
      />
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
      <div className="bg-surface border border-border rounded-xl p-5 md:p-6 w-full max-w-sm mx-4 shadow-2xl animate-fade-up">
        <h2 className="font-display text-2xl md:text-3xl text-fg tracking-wider mb-1">
          New Playlist
        </h2>
        <p className="font-mono text-xs text-muted mb-4 md:mb-6">choose a name</p>
        <input
          className="input mb-3"
          placeholder="My Playlist"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
            if (e.key === 'Escape') onClose();
          }}
          disabled={loading}
        />
        {error && <p className="font-mono text-xs text-danger mb-3">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSubmit}
            disabled={loading || !name.trim()}
          >
            Create
          </button>
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
        <div key={`skeleton-${i}`} className="card flex items-center gap-4 px-5 py-4">
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
          <button type="button" className="text-accent hover:underline" onClick={onCreate}>
            create the first playlist
          </button>
        </p>
      ) : (
        <p className="font-mono text-xs text-faint">no playlists have been created yet</p>
      )}
    </div>
  );
}

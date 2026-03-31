import type { PaginationMeta, Playlist } from '@alfira-bot/shared';
import { CaretRightIcon, GhostIcon, PlaylistIcon, PlusCircleIcon } from '@phosphor-icons/react';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPlaylistsPage, startPlayback } from '../api/api';
import { Backdrop } from '../components/Backdrop';
import EmptyState from '../components/EmptyState';
import NotificationToast from '../components/NotificationToast';
import { Pagination } from '../components/Pagination';
import { Button } from '../components/ui/Button';
import { useAdminView } from '../context/AdminViewContext';
import { usePlayer } from '../context/PlayerContext';
import { CreatePlaylistSubmitButton, useCreatePlaylist } from '../hooks/useCreatePlaylist';
import { useNotification } from '../hooks/useNotification';
import { useSocket } from '../hooks/useSocket';
import { apiErrorMessage } from '../utils/api';

export default function PlaylistsPage() {
  const { isAdminView } = useAdminView();
  const navigate = useNavigate();
  const socket = useSocket();
  const [items, setItems] = useState<Playlist[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const { notification, notify } = useNotification();
  const { state: queueState } = usePlayer();

  const load = useCallback(
    async (page: number) => {
      setLoading(true);
      try {
        const result = await getPlaylistsPage(isAdminView, page, 30);
        setItems(result.items);
        setPagination(result.pagination);
      } finally {
        setLoading(false);
      }
    },
    [isAdminView]
  );

  useEffect(() => {
    load(currentPage);
  }, [load, currentPage]);

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
      const isNew = !items.some((p) => p.id === updated.id);

      setItems((prev) => {
        if (prev.some((p) => p.id === updated.id)) {
          // Existing — replace (handles renames, song count changes)
          return prev.map((p) => (p.id === updated.id ? updated : p));
        }
        // New — prepend if page 1 has room
        if (currentPage === 1 && prev.length < 30) {
          return [updated, ...prev];
        }
        return prev;
      });

      // Only increment total for genuinely new playlists
      if (isNew) {
        setPagination((prev) => (prev ? { ...prev, total: prev.total + 1 } : prev));
      }
    };

    socket.on('playlists:updated', handlePlaylistUpdated);

    return () => {
      socket.off('playlists:updated', handlePlaylistUpdated);
    };
  }, [socket, currentPage, items]);

  const handleAddToQueue = async (playlistId: string) => {
    try {
      await startPlayback({ playlistId, mode: 'sequential', loop: queueState.loopMode });
      notify('Playlist added to queue', 'success');
    } catch (err: unknown) {
      notify(
        apiErrorMessage(err, 'Could not add to queue. Is the bot in a voice channel?'),
        'error',
        5000
      );
    }
  };

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="font-display text-3xl md:text-4xl text-fg tracking-wider">Playlists</h1>
          <p className="font-mono text-xs text-muted mt-1">
            {loading
              ? '—'
              : `${pagination?.total ?? items.length} playlist${(pagination?.total ?? items.length) !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowCreate(true)}
          className={showCreate ? 'pressed' : ''}
        >
          + New Playlist
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <SkeletonList />
      ) : items.length === 0 ? (
        <EmptyState
          title="No Playlists"
          isAdmin={isAdminView}
          onAdd={() => setShowCreate(true)}
          addLabel="create the first playlist"
        />
      ) : (
        <div className="grid gap-2 md:gap-3">
          {items.map((pl, i) => (
            <PlaylistRow
              key={pl.id}
              playlist={pl}
              style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
              onClick={() => navigate(`/playlists/${pl.id}`)}
              onAddToQueue={(e) => {
                e.stopPropagation();
                handleAddToQueue(pl.id);
              }}
            />
          ))}
        </div>
      )}

      {pagination && (
        <Pagination pagination={pagination} onPageChange={(page) => setCurrentPage(page)} />
      )}

      {showCreate && <CreatePlaylistModal onClose={() => setShowCreate(false)} />}
      {notification && <NotificationToast notification={notification} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Playlist row
// ---------------------------------------------------------------------------
function PlaylistRow({
  playlist,
  style,
  onClick,
  onAddToQueue,
}: {
  playlist: Playlist;
  style?: React.CSSProperties;
  onClick: () => void;
  onAddToQueue: (e: React.MouseEvent) => void;
}) {
  const count = playlist._count?.songs ?? 0;
  return (
    <div
      className="flex items-center gap-3 md:gap-4 px-4 md:px-5 py-3.5 md:py-4 cursor-pointer group bg-elevated rounded-xl clay-resting hover:clay-raised active:clay-flat transition-all duration-100 animate-fade-up opacity-0"
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
      {/* Add to queue button */}
      <Button
        variant="foreground"
        size="icon"
        onClick={onAddToQueue}
        className="opacity-0 group-hover:opacity-100 md:opacity-0"
        title="Add to queue"
      >
        <PlusCircleIcon size={20} weight="duotone" />
      </Button>
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
function CreatePlaylistModal({ onClose }: { onClose: () => void }) {
  const [state, formAction] = useCreatePlaylist();
  const [name, setName] = useState('');

  // Close modal on success (error === null means success)
  useEffect(() => {
    if (state?.error === null) {
      onClose();
    }
  }, [state, onClose]);

  return (
    <Backdrop onClose={onClose}>
      <form
        action={formAction}
        className="bg-surface border border-border rounded-xl p-5 md:p-6 w-full max-w-sm mx-4 modal-clay animate-fade-up"
      >
        <h2 className="font-display text-2xl md:text-3xl text-fg tracking-wider mb-1">
          New Playlist
        </h2>
        <p className="font-mono text-xs text-muted mb-4 md:mb-6">choose a name</p>
        <input
          name="name"
          className="input mb-3"
          placeholder="My Playlist"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
          }}
          required
        />
        {state?.error && <p className="font-mono text-xs text-danger mb-3">{state.error}</p>}
        <div className="flex gap-2 justify-end">
          <Button variant="foreground" type="button" onClick={onClose}>
            Cancel
          </Button>
          <CreatePlaylistSubmitButton disabled={!name.trim()}>Create</CreatePlaylistSubmitButton>
        </div>
      </form>
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

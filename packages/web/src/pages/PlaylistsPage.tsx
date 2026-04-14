import type { Playlist } from '@alfira-bot/server/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPlaylistsPage } from '../api/api';
import { Backdrop } from '../components/Backdrop';
import EmptyState from '../components/EmptyState';
import NotificationToast from '../components/NotificationToast';
import PlaylistRow from '../components/PlaylistRow';
import { Button } from '../components/ui/Button';
import { useAdminView } from '../context/AdminViewContext';
import { CreatePlaylistSubmitButton, useCreatePlaylist } from '../hooks/useCreatePlaylist';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useItemsPerPage } from '../hooks/useItemsPerPage';
import { useNotification } from '../hooks/useNotification';
import { onSocketEvent } from '../hooks/useSocket';

export default function PlaylistsPage() {
  const { isAdminView } = useAdminView();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const { notification } = useNotification();
  const { itemsPerPage, setContainerRef } = useItemsPerPage();
  const itemsPerPageRef = useRef(itemsPerPage);
  itemsPerPageRef.current = itemsPerPage;

  const { items, total, setItems, setTotal, loading, loadingMore, sentinelRef } = useInfiniteScroll(
    (page) =>
      getPlaylistsPage(isAdminView, page, itemsPerPage).then((r) => ({
        items: r.items,
        total: r.pagination.total,
      }))
  );

  const itemsRef = useRef(items);
  itemsRef.current = items;

  // ---------------------------------------------------------------------------
  // Real-time socket wiring
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handlePlaylistUpdated = (updated: Playlist) => {
      const isNew = !itemsRef.current.some((p) => p.id === updated.id);

      setItems((prev) => {
        if (prev.some((p) => p.id === updated.id)) {
          // Existing — replace (handles renames, song count changes)
          return prev.map((p) => (p.id === updated.id ? updated : p));
        }
        // New — prepend if we have room (at least 1 slot showing)
        if (prev.length < itemsPerPageRef.current) {
          return [updated, ...prev];
        }
        return prev;
      });

      // Only increment total for genuinely new playlists
      if (isNew) {
        setTotal((prev) => prev + 1);
      }
    };

    const offUpdated = onSocketEvent('playlists:updated', handlePlaylistUpdated);

    return () => {
      offUpdated();
    };
  }, [setItems, setTotal]);

  const handleRowClick = useCallback(
    (e: React.MouseEvent) => {
      const row = e.currentTarget.closest('[data-playlist-id]');
      const playlistId = row?.getAttribute('data-playlist-id');
      if (playlistId) navigate(`/playlists/${playlistId}`);
    },
    [navigate]
  );

  return (
    <div ref={setContainerRef} className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="font-display text-3xl md:text-4xl text-fg tracking-wider">Playlists</h1>
          <p className="font-mono text-xs text-muted mt-1">
            {loading ? '—' : `${total} playlist${total !== 1 ? 's' : ''}`}
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
              animationDelay={`${Math.min(i * 40, 400)}ms`}
              data-playlist-id={pl.id}
              onClick={handleRowClick}
            />
          ))}
        </div>
      )}

      {loadingMore && <SkeletonList />}

      <div ref={sentinelRef} className="h-4" />

      {showCreate && <CreatePlaylistModal onClose={() => setShowCreate(false)} />}
      {notification && <NotificationToast notification={notification} />}
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
          <Button variant="inherit" type="button" onClick={onClose} surface="surface">
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

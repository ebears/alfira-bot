import type { Playlist, Song } from '@alfira-bot/server/shared';
import { ListIcon, MagnifyingGlassIcon, SquaresFourIcon } from '@phosphor-icons/react';
import { startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { deleteSong, getPlaylistsPage, getSongsPage, startPlayback } from '../api/api';
import AddSongModal from '../components/AddSongModal';
import ConfirmModal from '../components/ConfirmModal';
import NotificationToast from '../components/NotificationToast';
import SongCard from '../components/SongCard';
import SongRow from '../components/SongRow';
import { Button } from '../components/ui/Button';
import { useAdminView } from '../context/AdminViewContext';
import { usePlayerState } from '../context/PlayerContext';
import { useAddToQueue } from '../hooks/useAddToQueue';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useItemsPerPage } from '../hooks/useItemsPerPage';
import { useNotification } from '../hooks/useNotification';
import { onSocketEvent } from '../hooks/useSocket';
import { apiErrorMessage } from '../utils/api';

export default function SongsPage() {
  const { isAdminView } = useAdminView();
  const { state: queueState } = usePlayerState();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const { handleAddToQueue, notification } = useAddToQueue();
  const { notify } = useNotification();
  const handleSetDeleteId = useCallback((id: string | null) => setDeleteId(id), []);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    const saved = localStorage.getItem('alfira-library-view');
    return saved === 'list' ? 'list' : 'grid';
  });
  const { itemsPerPage, setContainerRef } = useItemsPerPage();

  const { items, total, setItems, setTotal, loading, loadingMore, sentinelRef, reset } =
    useInfiniteScroll((page) => getSongsPage(page, itemsPerPage, search), { enabled: !search });

  // Ref to access items inside stale closures
  const itemsRef = useRef(items);
  const itemsPerPageRef = useRef(itemsPerPage);
  itemsRef.current = items;
  itemsPerPageRef.current = itemsPerPage;

  // Lazy playlists fetch — fetched separately so it doesn't block the main load
  useEffect(() => {
    void getPlaylistsPage(isAdminView, 1, 100)
      .then((p) => setPlaylists(p.items))
      .catch(() => {
        /* Silently ignore playlist fetch error */
      });
  }, [isAdminView]);

  useEffect(() => {
    const handleSongAdded = (song: Song) => {
      if (!search && itemsRef.current.length < itemsPerPageRef.current) {
        setItems((prev) => {
          if (prev.some((s) => s.id === song.id)) return prev;
          return [song, ...prev];
        });
      }
      setTotal((prev) => prev + 1);
    };
    const handleSongDeleted = (id: string) => {
      setItems((prev) => prev.filter((s) => s.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
    };
    const handleSongUpdated = (updatedSong: Song) => {
      setItems((prev) =>
        prev.map((s) =>
          s.id === updatedSong.id ? { ...updatedSong, addedByDisplayName: s.addedByDisplayName } : s
        )
      );
    };
    const offAdded = onSocketEvent('songs:added', handleSongAdded);
    const offDeleted = onSocketEvent('songs:deleted', handleSongDeleted);
    const offUpdated = onSocketEvent('songs:updated', handleSongUpdated);
    return () => {
      offAdded();
      offDeleted();
      offUpdated();
    };
  }, [search, setItems, setTotal]);

  const handleDelete = async (id: string) => {
    await deleteSong(id);
    setDeleteId(null);
    // Socket event will update the songs list
  };

  // ---------------------------------------------------------------------------
  // Play from song — replaces the queue with the full library starting from
  // the clicked song, then continues sequentially through the rest.
  // ---------------------------------------------------------------------------

  const handlePlayFromSong = useCallback(
    async (songId: string) => {
      setPlayingId(songId);
      try {
        await startPlayback({
          mode: 'sequential',
          loop: queueState.loopMode,
          startFromSongId: songId,
        });
        notify('Started playback', 'success');
      } catch (err: unknown) {
        notify(
          apiErrorMessage(err, 'Could not start playback. Is the bot in a voice channel?'),
          'error',
          5000
        );
      } finally {
        setPlayingId(null);
      }
    },
    [queueState.loopMode, notify]
  );

  const isGrid = viewMode === 'grid';

  const songContent = loading ? (
    isGrid ? (
      <SkeletonGrid itemsPerPage={itemsPerPage} />
    ) : (
      <SkeletonList itemsPerPage={itemsPerPage} />
    )
  ) : items.length === 0 ? (
    <div className="text-center py-24">
      <p className="font-display text-4xl text-faint tracking-wider mb-2">No Results</p>
      <p className="font-mono text-xs text-faint">no songs match "{search}"</p>
    </div>
  ) : isGrid ? (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-3 md:gap-4 items-start">
      {items.map((song, i) => (
        <SongCard
          key={song.id}
          song={song}
          isAdmin={isAdminView}
          isAdminView={isAdminView}
          playlists={playlists}
          delay={i}
          onDelete={handleSetDeleteId}
          onPlay={handlePlayFromSong}
          isPlaying={playingId === song.id}
          onAddToQueue={handleAddToQueue}
        />
      ))}
    </div>
  ) : (
    <div className="flex flex-col gap-1">
      {items.map((song) => (
        <SongRow
          key={song.id}
          song={song}
          isAdmin={isAdminView}
          isAdminView={isAdminView}
          playlists={playlists}
          onDelete={handleSetDeleteId}
          onPlay={() => handlePlayFromSong(song.id)}
          isPlaying={playingId === song.id}
          onAddToQueue={() => handleAddToQueue(song.id)}
        />
      ))}
    </div>
  );

  return (
    <div ref={setContainerRef} className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="font-display text-3xl md:text-4xl text-fg tracking-wider">Songs</h1>
          <p className="font-mono text-xs text-muted mt-1">
            {loading ? '—' : `${total} track${total !== 1 ? 's' : ''}`}
          </p>
        </div>
        {isAdminView && (
          <Button
            variant="primary"
            onClick={() => setShowAddModal(true)}
            className={showAddModal ? 'pressed' : ''}
          >
            + Add Song
          </Button>
        )}
      </div>

      {/* Search and view toggle */}
      <div className="flex items-center gap-2 mb-4 md:mb-6">
        <div className="relative flex-1">
          <MagnifyingGlassIcon
            className="absolute left-3 top-1/2 -translate-y-1/2 text-faint w-4 h-4 md:w-3.5 md:h-3.5"
            weight="duotone"
          />
          <input
            className="input pl-10"
            placeholder="Search by title, nickname, artist, album, or tag..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              reset();
            }}
          />
        </div>
        {/* View toggle */}
        <div className="flex items-center gap-1">
          <Button
            variant="inherit"
            surface="surface"
            size="icon"
            onClick={() => {
              startTransition(() => {
                setViewMode('grid');
                localStorage.setItem('alfira-library-view', 'grid');
              });
            }}
            className={isGrid ? 'pressed text-accent' : ''}
            title="Grid view"
          >
            <SquaresFourIcon size={18} weight="duotone" />
          </Button>
          <Button
            variant="inherit"
            surface="surface"
            size="icon"
            onClick={() => {
              startTransition(() => {
                setViewMode('list');
                localStorage.setItem('alfira-library-view', 'list');
              });
            }}
            className={isGrid ? '' : 'pressed text-accent'}
            title="List view"
          >
            <ListIcon size={18} weight="duotone" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {songContent}

      {/* Loading more skeletons */}
      {loadingMore &&
        (isGrid ? (
          <SkeletonGrid itemsPerPage={Math.max(4, Math.round(itemsPerPage / 2))} />
        ) : (
          <SkeletonList itemsPerPage={Math.max(4, Math.round(itemsPerPage / 2))} />
        ))}

      {!search && <div ref={sentinelRef} className="h-4" />}

      {/* Modals */}
      {showAddModal && (
        <AddSongModal
          onClose={() => setShowAddModal(false)}
          onAdded={(song) => {
            setItems((prev) => {
              if (prev.some((s) => s.id === song.id)) return prev;
              return [song, ...prev];
            });
            setTotal((prev) => prev + 1);
            setShowAddModal(false);
          }}
        />
      )}

      {deleteId && (
        <DeleteConfirmDialog
          song={items.find((s) => s.id === deleteId)}
          onConfirm={() => handleDelete(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}

      {/* Notification Toast */}
      {notification && <NotificationToast notification={notification} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loading grid
// ---------------------------------------------------------------------------
function SkeletonGrid({ itemsPerPage }: { itemsPerPage: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-3 md:gap-4">
      {Array.from({ length: Math.max(4, Math.round(itemsPerPage / 2)) }).map((_, i) => (
        <div key={i} className="flex flex-col bg-elevated rounded-xl clay-resting">
          {/* Thumbnail */}
          <div className="relative aspect-square bg-elevated overflow-hidden rounded-xl clay-flat m-3 mb-0">
            <div className="skeleton w-full h-full" />
            {/* Duration badge placeholder */}
            <div className="absolute bottom-2 right-2 z-20">
              <div className="skeleton h-3 w-8" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loading list
// ---------------------------------------------------------------------------
function SkeletonList({ itemsPerPage }: { itemsPerPage: number }) {
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: Math.max(4, Math.round(itemsPerPage / 2)) }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-2 md:gap-4 px-3 md:px-4 py-3 rounded-lg bg-elevated clay-resting"
        >
          <div className="skeleton w-12 h-12 md:w-10 md:h-10 rounded border border-border shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="skeleton h-3 w-3/4" />
            <div className="skeleton h-2 w-1/2 mt-1" />
          </div>
          <div className="skeleton h-3 w-10 shrink-0" />
          <div className="skeleton h-6 w-6 shrink-0" />
        </div>
      ))}
    </div>
  );
}

function DeleteConfirmDialog({
  song,
  onConfirm,
  onCancel,
}: {
  song: Song | undefined;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!song) return null;
  return (
    <ConfirmModal
      title="Delete Song"
      message={
        <>
          Remove <span className="text-fg font-semibold">"{song.nickname || song.title}"</span> from
          the library?{' '}
          <span className="font-mono text-xs text-danger/70">
            this will remove it from all playlists too.
          </span>
        </>
      }
      confirmLabel="Delete"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

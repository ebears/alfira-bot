import type { PaginationMeta, Playlist, Song } from '@alfira-bot/shared';
import { ListIcon, MagnifyingGlassIcon, SquaresFourIcon } from '@phosphor-icons/react';
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deleteSong, getPlaylistsPage, getSongsPage, startPlayback } from '../api/api';
import AddSongModal from '../components/AddSongModal';
import ConfirmModal from '../components/ConfirmModal';
import LibrarySongRow from '../components/LibrarySongRow';
import NotificationToast from '../components/NotificationToast';
import { Pagination } from '../components/Pagination';
import SongCard from '../components/SongCard';
import { Button } from '../components/ui/Button';
import { useAdminView } from '../context/AdminViewContext';
import { usePlayerState } from '../context/PlayerContext';
import { useAddToQueue } from '../hooks/useAddToQueue';
import { useNotification } from '../hooks/useNotification';
import { useSocket } from '../hooks/useSocket';
import { apiErrorMessage } from '../utils/api';

export default function SongsPage() {
  const { isAdminView } = useAdminView();
  const socket = useSocket();
  const { state: queueState } = usePlayerState();
  const [items, setItems] = useState<Song[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
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

  // Lazy playlists fetch — fetched separately so it doesn't block the main load
  useEffect(() => {
    void getPlaylistsPage(isAdminView, 1, 100)
      .then((p) => setPlaylists(p.items))
      .catch(() => {});
  }, [isAdminView]);

  // Refs to track state for socket handlers without causing effect re-runs
  const paginationRef = useRef(pagination);
  const itemsLengthRef = useRef(items.length);
  paginationRef.current = pagination;
  itemsLengthRef.current = items.length;

  const load = useCallback(async (page: number, searchQuery?: string) => {
    setLoading(true);
    try {
      const result = await getSongsPage(page, 30, searchQuery);
      setItems(result.items);
      setPagination(result.pagination);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(currentPage, search);
  }, [load, currentPage, search]);

  useEffect(() => {
    const handleSongAdded = (song: Song) => {
      // Only prepend on page 1; increment total count
      if (currentPage !== 1) {
        setPagination((prev) => (prev ? { ...prev, total: prev.total + 1 } : prev));
        return;
      }
      setItems((prev) => {
        if (prev.some((s) => s.id === song.id)) return prev;
        const next = [song, ...prev];
        if (next.length > 30) next.pop();
        return next;
      });
      setPagination((prev) => (prev ? { ...prev, total: prev.total + 1 } : prev));
    };

    const handleSongDeleted = (id: string) => {
      setPagination((prev) => (prev ? { ...prev, total: Math.max(0, prev.total - 1) } : prev));

      if (currentPage !== 1) {
        setItems((prev) => prev.filter((s) => s.id !== id));
        return;
      }

      // Capture length before filtering to determine if we need to refill
      const prevLength = itemsLengthRef.current;
      setItems((prev) => prev.filter((s) => s.id !== id));

      if (prevLength === 30 && paginationRef.current && paginationRef.current.total > 30) {
        getSongsPage(currentPage + 1, 30).then((result) => {
          setItems((prev) => [...prev, ...result.items].slice(0, 30));
        });
      }
    };

    const handleSongUpdated = (updatedSong: Song) => {
      setItems((prev) =>
        prev.map((s) =>
          s.id === updatedSong.id
            ? {
                ...updatedSong,
                addedByDisplayName: s.addedByDisplayName,
              }
            : s
        )
      );
    };

    socket.on('songs:added', handleSongAdded);
    socket.on('songs:deleted', handleSongDeleted);
    socket.on('songs:updated', handleSongUpdated);

    return () => {
      socket.off('songs:added', handleSongAdded);
      socket.off('songs:deleted', handleSongDeleted);
      socket.off('songs:updated', handleSongUpdated);
    };
  }, [socket, currentPage]);

  const handleDelete = async (id: string) => {
    await deleteSong(id);
    setDeleteId(null);
    // Socket event will update the songs list
  };

  const q = search.toLowerCase();
  const filtered = useMemo(
    () =>
      search
        ? items.filter(
            (s) => s.title.toLowerCase().includes(q) || s.nickname?.toLowerCase().includes(q)
          )
        : items,
    [search, items, q]
  );

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
      <SkeletonGrid />
    ) : (
      <SkeletonList />
    )
  ) : filtered.length === 0 ? (
    <div className="text-center py-24">
      <p className="font-display text-4xl text-faint tracking-wider mb-2">No Results</p>
      <p className="font-mono text-xs text-faint">no songs match "{search}"</p>
    </div>
  ) : isGrid ? (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-3 md:gap-4">
      {filtered.map((song, i) => (
        <SongCard
          key={song.id}
          song={song}
          isAdmin={isAdminView}
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
      {filtered.map((song) => (
        <LibrarySongRow
          key={song.id}
          song={song}
          isAdmin={isAdminView}
          playlists={playlists}
          onDelete={handleSetDeleteId}
          onPlay={handlePlayFromSong}
          isPlaying={playingId === song.id}
          onAddToQueue={handleAddToQueue}
        />
      ))}
    </div>
  );

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="font-display text-3xl md:text-4xl text-fg tracking-wider">Library</h1>
          <p className="font-mono text-xs text-muted mt-1">
            {loading
              ? '—'
              : `${pagination?.total ?? items.length} track${(pagination?.total ?? items.length) !== 1 ? 's' : ''}`}
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
            placeholder="Search by title or nickname..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        {/* View toggle */}
        <div className="flex items-center gap-1">
          <Button
            variant="foreground"
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
            variant="foreground"
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

      {pagination && <Pagination pagination={pagination} onPageChange={setCurrentPage} />}

      {/* Modals */}
      {showAddModal && (
        <AddSongModal
          onClose={() => setShowAddModal(false)}
          onAdded={(song) => {
            if (currentPage === 1) {
              setItems((prev) => {
                if (prev.some((s) => s.id === song.id)) return prev;
                return [song, ...prev];
              });
            }
            setPagination((prev) => (prev ? { ...prev, total: prev.total + 1 } : prev));
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
function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-3 md:gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex flex-col bg-elevated rounded-xl clay-resting">
          {/* Thumbnail */}
          <div className="relative aspect-video bg-elevated overflow-hidden rounded-xl clay-flat m-3 mb-0">
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
function SkeletonList() {
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-2 md:gap-4 px-3 md:px-4 py-3 rounded-lg bg-elevated clay-resting"
        >
          <div className="skeleton w-20 h-12 md:w-16 md:h-10 rounded border border-border shrink-0" />
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

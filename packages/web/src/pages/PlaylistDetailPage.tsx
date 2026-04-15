import type { Playlist, PlaylistDetail, Song } from '@alfira-bot/server/shared';
import {
  BombIcon,
  CaretLeftIcon,
  GhostIcon,
  LockIcon,
  LockOpenIcon,
  PencilSimple,
  PlayCircleIcon,
  PlayIcon,
  PlusCircleIcon,
} from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  deletePlaylist,
  getPlaylistPage,
  removeSongFromPlaylist,
  renamePlaylist,
  startPlayback,
  togglePlaylistVisibility,
} from '../api/api';
import AddSongsModal from '../components/AddSongsModal';
import ConfirmModal from '../components/ConfirmModal';
import type { MenuItem } from '../components/ContextMenu';
import { ContextMenu, ContextMenuTrigger } from '../components/ContextMenu';
import EmptyState from '../components/EmptyState';
import NotificationToast from '../components/NotificationToast';
import PlayModal from '../components/PlayModal';
import { Button } from '../components/ui/Button';
import { VirtualSongList } from '../components/VirtualSongList';
import { useAdminView } from '../context/AdminViewContext';
import { useAuth } from '../context/AuthContext';
import { usePlayerState } from '../context/PlayerContext';
import { useAddToQueue } from '../hooks/useAddToQueue';
import { useNotification } from '../hooks/useNotification';
import { onSocketEvent } from '../hooks/useSocket';
import { apiErrorMessage } from '../utils/api';

const ITEMS_PER_PAGE = 24;

export default function PlaylistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAdminView } = useAdminView();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [playlistDetail, setPlaylistDetail] = useState<PlaylistDetail | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const [showAddSongs, setShowAddSongs] = useState(false);
  const [showPlay, setShowPlay] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const { handleAddToQueue, notification } = useAddToQueue();
  const { notify } = useNotification();

  const isOwner = user?.discordId === playlistDetail?.createdBy;
  const canEdit = isAdminView || isOwner;
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const { state: queueState } = usePlayerState();

  // Refs for socket handlers
  const idRef = useRef(id);
  const isAdminViewRef = useRef(isAdminView);
  idRef.current = id;
  isAdminViewRef.current = isAdminView;

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isError, setIsError] = useState(false);

  // Accumulated songs from all pages
  const [songs, setSongs] = useState<PlaylistDetail['songs']>([]);

  // IntersectionObserver ref for sentinel
  const observerRef = useRef<IntersectionObserver | null>(null);

  const loadPage = useCallback(async (page: number, isInitial = false, isRefetch = false) => {
    if (!idRef.current) return;

    if (isInitial) {
      setIsLoading(true);
      setSongs([]);
    } else {
      setIsFetching(true);
    }
    setIsError(false);

    try {
      const pl = await getPlaylistPage(idRef.current, isAdminViewRef.current, page, ITEMS_PER_PAGE);

      if (isInitial) {
        setPlaylistDetail(pl);
        setSongs(pl.songs);
        setRenameValue(pl.name);
      } else if (isRefetch) {
        // Socket-triggered refetch: replace songs so we don't accumulate duplicates.
        setSongs(pl.songs);
        setPlaylistDetail(pl);
      } else {
        // User scroll: accumulate songs from the new page.
        setSongs((prev) => [...prev, ...pl.songs]);
        // Keep latest playlist metadata
        setPlaylistDetail(pl);
      }
      setHasMore(pl.songs.length === ITEMS_PER_PAGE);
    } catch {
      setIsError(true);
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    void loadPage(1, true);
  }, [loadPage]);

  // Socket: playlist updated (rename, visibility, song count changes)
  useEffect(() => {
    const handlePlaylistUpdated = (updated: Playlist) => {
      if (updated.id !== idRef.current) return;
      // Refetch current page to get updated playlist + songs
      void loadPage(currentPage, false, true);
    };

    const offUpdated = onSocketEvent('playlists:updated', handlePlaylistUpdated);

    return () => {
      offUpdated();
    };
  }, [currentPage, loadPage]);

  // Socket: song edited — update in real-time
  useEffect(() => {
    const handleSongUpdated = (song: Song) => {
      setSongs((prev) => prev.map((ps) => (ps.songId === song.id ? { ...ps, song } : ps)));
    };

    const offSongUpdated = onSocketEvent('songs:updated', handleSongUpdated);

    return () => {
      offSongUpdated();
    };
  }, []);

  const handleRenameSave = async () => {
    if (!playlistDetail || !renameValue.trim() || renameValue.trim() === playlistDetail.name) {
      setRenameValue('');
      return;
    }
    setRenameSaving(true);
    try {
      const updated = await renamePlaylist(playlistDetail.id, renameValue.trim());
      setPlaylistDetail((p) => (p ? { ...p, name: updated.name } : p));
    } finally {
      setRenameSaving(false);
      setRenameValue('');
    }
  };

  const handleRemoveSong = async (songId: string) => {
    if (!playlistDetail) return;

    const prevLength = songs.length;
    try {
      await removeSongFromPlaylist(playlistDetail.id, songId);
      setSongs((prev) => prev.filter((ps) => ps.songId !== songId));

      // Refill if we dropped below a page
      if (prevLength === ITEMS_PER_PAGE && hasMore && idRef.current) {
        getPlaylistPage(
          idRef.current,
          isAdminViewRef.current,
          currentPage + 1,
          ITEMS_PER_PAGE
        ).then((pl) => {
          setSongs((prev) => [...prev, ...pl.songs].slice(0, ITEMS_PER_PAGE * currentPage));
        });
      }
    } finally {
      setRemoveId(null);
    }
  };

  const handleDeletePlaylist = async () => {
    if (!playlistDetail) return;
    await deletePlaylist(playlistDetail.id);
    navigate('/playlists');
  };

  const handleToggleVisibility = async () => {
    if (!playlistDetail) return;
    try {
      const updated = await togglePlaylistVisibility(
        playlistDetail.id,
        !playlistDetail.isPrivate,
        isAdminView
      );
      setPlaylistDetail((p) => (p ? { ...p, isPrivate: updated.isPrivate } : p));
      notify(updated.isPrivate ? 'Playlist set to private' : 'Playlist set to public', 'success');
    } catch (err: unknown) {
      notify(apiErrorMessage(err, 'Could not toggle visibility.'), 'error', 5000);
    }
  };

  const handlePlayFromSong = useCallback(
    async (
      songId: string,
      mode: 'sequential' | 'random' = 'sequential',
      { throwErrors = false }: { throwErrors?: boolean } = {}
    ) => {
      if (!playlistDetail) return;
      setPlayingSongId(songId);
      try {
        await startPlayback({
          playlistId: playlistDetail.id,
          mode,
          loop: queueState.loopMode,
          startFromSongId: songId,
        });
      } catch (err: unknown) {
        if (throwErrors) {
          throw err;
        }
        notify(apiErrorMessage(err, 'Could not start playback.'), 'error', 5000);
      } finally {
        setPlayingSongId(null);
      }
    },
    [playlistDetail, queueState.loopMode, notify]
  );

  const handleAddPlaylistToQueue = useCallback(async () => {
    if (!playlistDetail) return;
    try {
      await startPlayback({
        playlistId: playlistDetail.id,
        mode: 'sequential',
        loop: queueState.loopMode,
      });
      notify(`Added "${playlistDetail.name}" to queue`, 'success');
    } catch (err: unknown) {
      notify(apiErrorMessage(err, 'Could not add to queue.'), 'error', 5000);
    }
  }, [playlistDetail, queueState.loopMode, notify]);

  const menuItems: MenuItem[] = [
    {
      id: 'add-to-queue',
      label: 'Add to Queue',
      icon: <PlusCircleIcon size={14} weight="duotone" />,
      disabled: songs.length === 0,
      onClick: handleAddPlaylistToQueue,
    },
    ...(isOwner || isAdminView
      ? [
          {
            id: 'rename',
            label: 'Rename',
            icon: <PencilSimple size={14} weight="duotone" />,
            editSubmenu: {
              title: 'Rename',
              value: renameValue,
              onChange: (val: string) => setRenameValue(val),
              onSave: handleRenameSave,
              onCancel: () => setRenameValue(''),
              saving: renameSaving,
              placeholder: 'Playlist name',
            },
          } as MenuItem,
          {
            id: 'toggle-visibility',
            label: playlistDetail?.isPrivate ? 'Make Public' : 'Make Private',
            icon: playlistDetail?.isPrivate ? (
              <LockOpenIcon size={14} weight="duotone" />
            ) : (
              <LockIcon size={14} weight="duotone" />
            ),
            onClick: handleToggleVisibility,
          } as MenuItem,
          {
            id: 'add-songs',
            label: 'Add Songs',
            icon: <PlayCircleIcon size={14} weight="duotone" />,
            onClick: () => setShowAddSongs(true),
          } as MenuItem,
          {
            id: 'delete',
            label: 'Delete',
            icon: <BombIcon size={14} weight="duotone" />,
            danger: true,
            onClick: () => setDeleteConfirm(true),
          } as MenuItem,
        ]
      : []),
  ];

  const loadMore = useCallback(() => {
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    void loadPage(nextPage, false);
  }, [currentPage, loadPage]);

  const retry = useCallback(() => {
    void loadPage(currentPage, false);
  }, [currentPage, loadPage]);

  // IntersectionObserver for infinite scroll
  const sentinelRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      if (!el) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting && !isFetching && hasMore) {
            loadMore();
          }
        },
        { rootMargin: '300px' }
      );

      observerRef.current.observe(el);
    },
    [isFetching, hasMore, loadMore]
  );

  // Cleanup observer on unmount
  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  if (isLoading) return <DetailSkeleton />;
  if (!playlistDetail) return null;

  // Extract plain songs from PlaylistDetailSong[]
  const songItems: Song[] = songs.map((ps) => ps.song);

  return (
    <div className="p-4 md:p-8">
      {/* Back */}
      <Button
        variant="inherit"
        surface="surface"
        onClick={() => navigate('/playlists')}
        className="flex items-center gap-1.5 font-mono text-xs mb-4 md:mb-6 min-h-11 md:min-h-0"
      >
        <CaretLeftIcon size={16} weight="duotone" className="md:w-3.5 md:h-3.5" />
        playlists
      </Button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 md:mb-8 gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl md:text-4xl text-fg tracking-wider">
              {playlistDetail.name}
            </h1>
            {playlistDetail.isPrivate && (
              <span className="text-muted text-sm" title="Private playlist">
                <GhostIcon size={14} weight="duotone" className="inline mr-1" />
                private
              </span>
            )}
          </div>
          <p className="font-mono text-xs text-muted mt-1">
            {songItems.length} {songItems.length === 1 ? 'track' : 'tracks'}
            {' • '}
            {isOwner
              ? 'Created by you'
              : `Created by ${playlistDetail.createdByDisplayName || playlistDetail.createdBy}`}
          </p>
        </div>

        <div className="flex gap-2 shrink-0 items-center">
          <Button
            variant="primary"
            className={`text-xs flex items-center gap-1.5 ${showPlay ? 'pressed' : ''}`}
            onClick={() => setShowPlay(true)}
            disabled={songItems.length === 0}
          >
            <PlayIcon size={14} weight="duotone" /> Play
          </Button>
          <ContextMenuTrigger
            ref={menuTriggerRef}
            onToggle={() => setMenuOpen((v) => !v)}
            isOpen={menuOpen}
          />
          {menuOpen && (
            <ContextMenu
              items={menuItems}
              isOpen={menuOpen}
              onClose={() => setMenuOpen(false)}
              triggerRef={menuTriggerRef}
            />
          )}
        </div>
      </div>

      {/* Song list */}
      {songItems.length === 0 && !isLoading ? (
        <EmptyState
          title="Empty Playlist"
          isAdmin={canEdit}
          onAdd={() => setShowAddSongs(true)}
          addLabel="add some songs"
        />
      ) : (
        <VirtualSongList
          items={songItems}
          viewMode="list"
          isAdmin={canEdit}
          isAdminView={isAdminView}
          playlists={[]}
          isLoading={isLoading}
          isFetching={isFetching}
          isError={isError}
          hasMore={hasMore}
          playingId={playingSongId}
          onRetry={retry}
          sentinelRef={sentinelRef}
          onDelete={(id) => {
            const ps = songs.find((p) => p.songId === id);
            if (ps) setRemoveId(ps.songId);
          }}
          onPlay={handlePlayFromSong}
          onAddToQueue={handleAddToQueue}
        />
      )}

      {/* Modals */}
      {showAddSongs && (
        <AddSongsModal
          playlist={playlistDetail}
          onClose={() => setShowAddSongs(false)}
          onAdded={() => {
            void loadPage(currentPage, false);
            setShowAddSongs(false);
          }}
        />
      )}
      {showPlay && (
        <PlayModal
          onClose={() => setShowPlay(false)}
          onPlay={(mode) => handlePlayFromSong(songs[0]?.songId, mode, { throwErrors: true })}
        />
      )}

      {/* Notification Toast */}
      {notification && <NotificationToast notification={notification} />}
      {removeId && (
        <ConfirmModal
          title="Remove Song"
          message={
            <>
              Remove{' '}
              <span className="text-fg font-semibold">
                "{songs.find((ps) => ps.songId === removeId)?.song?.title}"
              </span>{' '}
              from this playlist? The song won't be deleted from the library.
            </>
          }
          confirmLabel="Remove"
          onConfirm={() => handleRemoveSong(removeId)}
          onCancel={() => setRemoveId(null)}
        />
      )}
      {deleteConfirm && (
        <ConfirmModal
          title="Delete Playlist"
          message="This playlist will be permanently deleted. This cannot be undone."
          confirmLabel="Delete"
          onConfirm={() => {
            setDeleteConfirm(false);
            handleDeletePlaylist();
          }}
          onCancel={() => setDeleteConfirm(false)}
        />
      )}
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
        <div key={`skeleton-${i}`} className="flex items-center gap-4 py-3">
          <div className="skeleton w-6 h-3 rounded" />
          <div className="skeleton w-10 h-7 rounded" />
          <div className="skeleton h-3 flex-1 rounded" />
          <div className="skeleton h-3 w-12 rounded" />
        </div>
      ))}
    </div>
  );
}

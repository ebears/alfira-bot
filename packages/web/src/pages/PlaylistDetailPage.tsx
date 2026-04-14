import type { Playlist, PlaylistDetail } from '@alfira-bot/server/shared';
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
import { memo, useCallback, useEffect, useRef, useState } from 'react';
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
import SongRow from '../components/SongRow';
import { Button } from '../components/ui/Button';
import { useAdminView } from '../context/AdminViewContext';
import { useAuth } from '../context/AuthContext';
import { usePlayerState } from '../context/PlayerContext';
import { useAddToQueue } from '../hooks/useAddToQueue';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useItemsPerPage } from '../hooks/useItemsPerPage';
import { useNotification } from '../hooks/useNotification';
import { onSocketEvent } from '../hooks/useSocket';
import { apiErrorMessage } from '../utils/api';

export default function PlaylistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAdminView } = useAdminView();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const [showAddSongs, setShowAddSongs] = useState(false);
  const [showPlay, setShowPlay] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const { handleAddToQueue, notification } = useAddToQueue();
  const { notify } = useNotification();

  const isOwner = user?.discordId === playlist?.createdBy;
  const canEdit = isAdminView || isOwner;
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const { state: queueState } = usePlayerState();

  const { itemsPerPage, setContainerRef } = useItemsPerPage();
  const itemsPerPageRef = useRef(itemsPerPage);
  itemsPerPageRef.current = itemsPerPage;

  // Avoid skeleton flash when itemsPerPage calibrates after initial ResizeObserver measurement
  const hasLoadedRef = useRef(false);

  const {
    items: songs,
    total,
    setItems: setSongs,
    setTotal,
    loading,
    loadingMore,
    sentinelRef,
  } = useInfiniteScroll(
    (page) => {
      const playlistId = id;
      if (!playlistId) return Promise.reject(new Error('No playlist id'));
      return getPlaylistPage(playlistId, isAdminView, page, itemsPerPage).then((r) => ({
        items: r.songs,
        total: r.pagination.total,
      }));
    },
    { enabled: !!id }
  );

  // Refs to avoid stale closures in handleRemoveSong
  const itemsRef = useRef(songs);
  const songsLengthRef = useRef(0);
  itemsRef.current = songs;
  songsLengthRef.current = songs.length;

  // Sync refs on songs changes
  useEffect(() => {
    itemsRef.current = songs;
    songsLengthRef.current = songs.length;
  }, [songs]);

  // Set playlist name from first page response (happens once on initial load)
  useEffect(() => {
    if (!id || songs.length === 0) return;
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    // Fetch full playlist detail for metadata (name, visibility, etc.)
    getPlaylistPage(id, isAdminView, 1, itemsPerPage)
      .then((pl) => {
        setPlaylist(pl);
        setRenameValue(pl.name);
      })
      .catch(() => {
        navigate('/playlists', { replace: true });
      });
  }, [id, isAdminView, itemsPerPage, navigate, songs.length]);

  // Handle playlist updates from other clients
  useEffect(() => {
    const handlePlaylistUpdated = (updated: Playlist) => {
      if (updated.id !== id) return;
      // The payload has the complete songs array — use it directly
      setSongs(updated.songs as PlaylistDetail['songs']);
      setTotal(updated.songs.length);
    };

    const offUpdated = onSocketEvent('playlists:updated', handlePlaylistUpdated);

    return () => {
      offUpdated();
    };
  }, [id, setSongs, setTotal]);

  const handleRenameSave = async () => {
    if (!playlist || !renameValue.trim() || renameValue.trim() === playlist.name) {
      setRenameValue('');
      return;
    }
    setRenameSaving(true);
    try {
      const updated = await renamePlaylist(playlist.id, renameValue.trim());
      setPlaylist((p) => (p ? { ...p, name: updated.name } : p));
    } finally {
      setRenameSaving(false);
      setRenameValue('');
    }
  };

  const handleRemoveSong = async (songId: string) => {
    if (!playlist) return;

    const _prevLength = playlist.songs.length;
    await removeSongFromPlaylist(playlist.id, songId);

    setSongs((prev) => prev.filter((ps) => ps.songId !== songId));
    setTotal((prev) => Math.max(0, prev - 1));

    setRemoveId(null);
  };

  const handleDeletePlaylist = async () => {
    if (!playlist) return;
    await deletePlaylist(playlist.id);
    navigate('/playlists');
  };

  const handleToggleVisibility = async () => {
    if (!playlist) return;
    try {
      const updated = await togglePlaylistVisibility(playlist.id, !playlist.isPrivate, isAdminView);
      setPlaylist((p) => (p ? { ...p, isPrivate: updated.isPrivate } : p));
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
      if (!playlist) return;
      setPlayingSongId(songId);
      try {
        await startPlayback({
          playlistId: playlist.id,
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
    [playlist, queueState.loopMode, notify]
  );

  const handleAddPlaylistToQueue = useCallback(async () => {
    if (!playlist) return;
    try {
      await startPlayback({
        playlistId: playlist.id,
        mode: 'sequential',
        loop: queueState.loopMode,
      });
      notify(`Added "${playlist.name}" to queue`, 'success');
    } catch (err: unknown) {
      notify(apiErrorMessage(err, 'Could not add to queue.'), 'error', 5000);
    }
  }, [playlist, queueState.loopMode, notify]);

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
            label: playlist?.isPrivate ? 'Make Public' : 'Make Private',
            icon: playlist?.isPrivate ? (
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

  if (loading) return <DetailSkeleton />;
  if (!playlist) return null;

  return (
    <div ref={setContainerRef} className="p-4 md:p-8">
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
              {playlist.name}
            </h1>
            {playlist.isPrivate && (
              <span className="text-muted text-sm" title="Private playlist">
                <GhostIcon size={14} weight="duotone" className="inline mr-1" />
                private
              </span>
            )}
          </div>
          <p className="font-mono text-xs text-muted mt-1">
            {total} {total === 1 ? 'track' : 'tracks'}
            {' • '}
            {isOwner
              ? 'Created by you'
              : `Created by ${playlist.createdByDisplayName || playlist.createdBy}`}
          </p>
        </div>

        <div className="flex gap-2 shrink-0 items-center">
          <Button
            variant="primary"
            className={`text-xs flex items-center gap-1.5 ${showPlay ? 'pressed' : ''}`}
            onClick={() => setShowPlay(true)}
            disabled={total === 0}
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
      {songs.length === 0 ? (
        <EmptyState
          title="Empty Playlist"
          isAdmin={canEdit}
          onAdd={() => setShowAddSongs(true)}
          addLabel="add some songs"
        />
      ) : (
        <div className="flex flex-col gap-1">
          {songs.map((ps) => (
            <PlaylistSongRow
              key={ps.id}
              ps={ps}
              canEdit={canEdit}
              isAdminView={isAdminView}
              playingSongId={playingSongId}
              onPlayFromSong={handlePlayFromSong}
              onAddToQueue={handleAddToQueue}
              onRemoveSong={setRemoveId}
            />
          ))}
        </div>
      )}

      {loadingMore && (
        <div className="flex flex-col gap-1">
          {Array.from({ length: Math.max(4, Math.round(itemsPerPage / 2)) }).map((_, i) => (
            <div
              key={`skeleton-${i}`}
              className="flex items-center gap-4 px-3 md:px-4 py-3 rounded-lg bg-elevated clay-resting"
            >
              <div className="skeleton w-10 h-10 rounded border border-border shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="skeleton h-3 w-3/4" />
                <div className="skeleton h-2 w-1/2 mt-1" />
              </div>
              <div className="skeleton h-3 w-10 shrink-0" />
            </div>
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="h-4" />

      {/* Modals */}
      {showAddSongs && (
        <AddSongsModal
          playlist={playlist}
          onClose={() => setShowAddSongs(false)}
          onAdded={() => {
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

/** Extracted sub-component to stabilize per-row callbacks for `SongRow.memo()`. */
const PlaylistSongRow = memo(function PlaylistSongRow({
  ps,
  canEdit,
  isAdminView,
  playingSongId,
  onPlayFromSong,
  onAddToQueue,
  onRemoveSong,
}: {
  ps: PlaylistDetail['songs'][number];
  canEdit: boolean;
  isAdminView: boolean;
  playingSongId: string | null;
  onPlayFromSong: (songId: string) => void;
  onAddToQueue: (songId: string) => void;
  onRemoveSong: (songId: string) => void;
}) {
  return (
    <SongRow
      song={ps.song}
      isAdmin={canEdit}
      isAdminView={isAdminView}
      onRemove={() => onRemoveSong(ps.songId)}
      removeLabel="Remove from playlist"
      onPlay={() => onPlayFromSong(ps.songId)}
      isPlaying={playingSongId === ps.songId}
      onAddToQueue={() => onAddToQueue(ps.songId)}
    />
  );
});

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

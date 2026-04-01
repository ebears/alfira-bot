import type { PaginationMeta, Playlist, PlaylistDetail } from '@alfira-bot/shared';
import {
  BombIcon,
  CaretLeftIcon,
  GhostIcon,
  LockIcon,
  LockOpenIcon,
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
import { Pagination } from '../components/Pagination';
import PlayModal from '../components/PlayModal';
import SongRow from '../components/SongRow';
import { Button } from '../components/ui/Button';
import { useAdminView } from '../context/AdminViewContext';
import { useAuth } from '../context/AuthContext';
import { usePlayerState } from '../context/PlayerContext';
import { useAddToQueue } from '../hooks/useAddToQueue';
import { useNotification } from '../hooks/useNotification';
import { useSocket } from '../hooks/useSocket';
import { apiErrorMessage } from '../utils/api';

export default function PlaylistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAdminView } = useAdminView();
  const { user } = useAuth();
  const navigate = useNavigate();
  const socket = useSocket();

  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [showAddSongs, setShowAddSongs] = useState(false);
  const [showPlay, setShowPlay] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const { handleAddToQueue, notification } = useAddToQueue();
  const { notify } = useNotification();

  const isOwner = user?.discordId === playlist?.createdBy;
  const canEdit = isAdminView || isOwner;
  const nameInputRef = useRef<HTMLInputElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const { state: queueState } = usePlayerState();

  // Refs to avoid stale closures in handleRemoveSong
  const paginationRef = useRef(pagination);
  const songsLengthRef = useRef(0);
  paginationRef.current = pagination;
  songsLengthRef.current = playlist?.songs.length ?? 0;

  const load = useCallback(
    async (page: number) => {
      if (!id) return;
      setLoading(true);
      try {
        const pl = await getPlaylistPage(id, isAdminView, page, 30);
        setPlaylist(pl);
        setPagination(pl.pagination);
        setNameValue(pl.name);
      } catch {
        navigate('/playlists', { replace: true });
      } finally {
        setLoading(false);
      }
    },
    [id, navigate, isAdminView]
  );

  useEffect(() => {
    load(currentPage);
  }, [load, currentPage]);

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus();
  }, [editingName]);

  // Refetch on any playlist mutation from other clients (payload lacks full songs array)
  useEffect(() => {
    const handlePlaylistUpdated = (updated: Playlist) => {
      if (updated.id !== id) return;
      // Refetch to get the full PlaylistDetail including the updated songs array.
      load(currentPage);
    };

    socket.on('playlists:updated', handlePlaylistUpdated);

    return () => {
      socket.off('playlists:updated', handlePlaylistUpdated);
    };
  }, [socket, id, load, currentPage]);

  const handleRename = async () => {
    if (!playlist || !nameValue.trim() || nameValue.trim() === playlist.name) {
      setEditingName(false);
      setNameValue(playlist?.name ?? '');
      return;
    }
    const updated = await renamePlaylist(playlist.id, nameValue.trim());
    setPlaylist((p) => (p ? { ...p, name: updated.name } : p));
    setEditingName(false);
    // The socket event from the rename will also arrive and trigger a refetch,
    // but the optimistic update above means the user sees the change instantly.
  };

  const handleRemoveSong = async (songId: string) => {
    if (!playlist) return;

    const prevLength = playlist.songs.length;
    await removeSongFromPlaylist(playlist.id, songId);

    setPlaylist((p) =>
      p
        ? {
            ...p,
            songs: p.songs.filter((ps) => ps.songId !== songId),
          }
        : p
    );
    setPagination((prev) => (prev ? { ...prev, total: Math.max(0, prev.total - 1) } : prev));

    // Refill page 1 if we dropped below 30
    if (prevLength === 30 && paginationRef.current && paginationRef.current.total > 30 && id) {
      getPlaylistPage(id, isAdminView, currentPage + 1, 30).then((result) => {
        setPlaylist((p) =>
          p
            ? {
                ...p,
                songs: [...p.songs, ...result.songs].slice(0, 30),
              }
            : p
        );
      });
    }

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
      disabled: playlist?.songs.length === 0,
      onClick: handleAddPlaylistToQueue,
    },
    ...(isOwner || isAdminView
      ? [
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
    <div className="p-4 md:p-8">
      {/* Back */}
      <Button
        variant="foreground"
        onClick={() => navigate('/playlists')}
        className="flex items-center gap-1.5 font-mono text-xs mb-4 md:mb-6 min-h-11 md:min-h-0"
      >
        <CaretLeftIcon size={16} weight="duotone" className="md:w-3.5 md:h-3.5" />
        playlists
      </Button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 md:mb-8 gap-4">
        <div className="flex-1 min-w-0">
          {editingName && canEdit ? (
            <input
              ref={nameInputRef}
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') {
                  setEditingName(false);
                  setNameValue(playlist.name);
                }
              }}
              className="font-display text-3xl md:text-4xl bg-transparent text-fg tracking-wider border-b-2 border-accent outline-none w-full"
              style={{ fontSize: '2rem', lineHeight: 1 }}
            />
          ) : (
            <div className="flex items-center gap-2">
              <h1
                className={`font-display text-3xl md:text-4xl text-fg tracking-wider ${
                  canEdit
                    ? 'cursor-pointer hover:text-accent/90 active:text-accent transition-colors duration-150'
                    : ''
                }`}
                onClick={() => canEdit && setEditingName(true)}
                title={canEdit ? 'Click to rename' : undefined}
              >
                {playlist.name}
              </h1>
              {playlist.isPrivate && (
                <span className="text-muted text-sm" title="Private playlist">
                  <GhostIcon size={14} weight="duotone" className="inline mr-1" />
                  private
                </span>
              )}
            </div>
          )}
          <p className="font-mono text-xs text-muted mt-1">
            {pagination?.total ?? playlist.songs.length}{' '}
            {playlist.songs.length === 1 ? 'track' : 'tracks'}
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
            disabled={(pagination?.total ?? playlist.songs.length) === 0}
          >
            <PlayIcon size={14} weight="duotone" /> Play
          </Button>
          <ContextMenuTrigger
            ref={menuTriggerRef}
            onOpen={() => setMenuOpen(true)}
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
      {playlist.songs.length === 0 ? (
        <EmptyState
          title="Empty Playlist"
          isAdmin={canEdit}
          onAdd={() => setShowAddSongs(true)}
          addLabel="add some songs"
        />
      ) : (
        <div className="flex flex-col gap-1">
          {playlist.songs.map((ps) => (
            <PlaylistSongRow
              key={ps.id}
              ps={ps}
              canEdit={canEdit}
              playingSongId={playingSongId}
              onPlayFromSong={handlePlayFromSong}
              onAddToQueue={handleAddToQueue}
              onRemoveSong={setRemoveId}
            />
          ))}
        </div>
      )}

      {pagination && <Pagination pagination={pagination} onPageChange={setCurrentPage} />}

      {/* Modals */}
      {showAddSongs && (
        <AddSongsModal
          playlist={playlist}
          onClose={() => setShowAddSongs(false)}
          onAdded={() => {
            load(currentPage);
            setShowAddSongs(false);
          }}
        />
      )}
      {showPlay && (
        <PlayModal
          onClose={() => setShowPlay(false)}
          onPlay={(mode) =>
            handlePlayFromSong(playlist.songs[0]?.songId, mode, { throwErrors: true })
          }
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
                "{playlist.songs.find((ps) => ps.songId === removeId)?.song?.title}"
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
  playingSongId,
  onPlayFromSong,
  onAddToQueue,
  onRemoveSong,
}: {
  ps: PlaylistDetail['songs'][number];
  canEdit: boolean;
  playingSongId: string | null;
  onPlayFromSong: (songId: string) => void;
  onAddToQueue: (songId: string) => void;
  onRemoveSong: (songId: string) => void;
}) {
  return (
    <SongRow
      song={ps.song}
      isAdmin={canEdit}
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

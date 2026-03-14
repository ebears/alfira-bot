import type { Playlist, PlaylistDetail, Song } from '@alfira-bot/shared';
import { formatDuration } from '@alfira-bot/shared';
import {
  BombIcon,
  CaretLeftIcon,
  GhostIcon,
  LockIcon,
  LockOpenIcon,
  PlayCircleIcon,
  PlayIcon,
  PlusCircleIcon,
  VinylRecordIcon,
} from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  addSongToPlaylist,
  deletePlaylist,
  getPlaylist,
  getSongs,
  removeSongFromPlaylist,
  renamePlaylist,
  startPlayback,
  togglePlaylistVisibility,
} from '../api/api';
import { Backdrop } from '../components/Backdrop';
import ConfirmModal from '../components/ConfirmModal';
import NotificationToast from '../components/NotificationToast';
import { useAdminView } from '../context/AdminViewContext';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
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
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [showAddSongs, setShowAddSongs] = useState(false);
  const [showPlay, setShowPlay] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const { notification, notify } = useNotification();
  const handleAddToQueue = useAddToQueue();

  // Allow editing when:
  // - User is admin AND edit mode is enabled, OR
  // - User is the playlist owner AND edit mode is enabled
  const isOwner = user?.discordId === playlist?.createdBy;
  const canEdit = (isAdminView || isOwner) && isEditMode;
  const nameInputRef = useRef<HTMLInputElement>(null);

  const { state: queueState } = usePlayer();

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const pl = await getPlaylist(id, isAdminView);
      setPlaylist(pl);
      setNameValue(pl.name);
    } catch {
      navigate('/playlists', { replace: true });
    } finally {
      setLoading(false);
    }
  }, [id, navigate, isAdminView]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus();
  }, [editingName]);

  // ---------------------------------------------------------------------------
  // Real-time socket wiring
  //
  // playlists:updated fires after any mutation: rename, song added, song removed,
  // or a new playlist being created. We only care about events for this playlist.
  //
  // The payload is a Playlist (with _count.songs) but does NOT include the full
  // songs array — that's a PlaylistDetail shape. So when we receive an update
  // for this playlist we trigger a full refetch to get the fresh songs list.
  //
  // This also handles the case where an admin in another browser tab renames
  // the playlist or adds/removes songs — the detail view stays in sync.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handlePlaylistUpdated = (updated: Playlist) => {
      if (updated.id !== id) return;
      // Refetch to get the full PlaylistDetail including the updated songs array.
      load();
    };

    socket.on('playlists:updated', handlePlaylistUpdated);

    return () => {
      socket.off('playlists:updated', handlePlaylistUpdated);
    };
  }, [socket, id, load]);

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

  const toggleEditMode = () => {
    setIsEditMode((prev) => !prev);
    setEditingName(false);
  };

  const handleRemoveSong = async (songId: string) => {
    if (!playlist) return;
    await removeSongFromPlaylist(playlist.id, songId);
    // Optimistic update — the socket event will also arrive and trigger a
    // refetch, which will reconcile any inconsistency.
    setPlaylist((p) =>
      p
        ? {
            ...p,
            songs: p.songs.filter((ps) => ps.songId !== songId),
          }
        : p
    );
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

  const handlePlayFromSong = async (
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
  };

  const handleAddPlaylistToQueue = async (mode: 'sequential' | 'random' = 'sequential') => {
    if (!playlist) return;
    try {
      await startPlayback({
        playlistId: playlist.id,
        mode,
        loop: queueState.loopMode,
      });
      notify(`Added "${playlist.name}" to queue`, 'success');
    } catch (err: unknown) {
      notify(apiErrorMessage(err, 'Could not add to queue.'), 'error', 5000);
    }
  };

  if (loading) return <DetailSkeleton />;
  if (!playlist) return null;

  return (
    <div className="p-4 md:p-8">
      {/* Back */}
      <button
        type="button"
        onClick={() => navigate('/playlists')}
        className="flex items-center gap-1.5 font-mono text-xs text-muted hover:text-fg active:text-fg transition-colors duration-150 mb-4 md:mb-6 min-h-11 md:min-h-0"
      >
        <CaretLeftIcon size={16} weight="duotone" className="md:w-3.5 md:h-3.5" />
        playlists
      </button>

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
              className="font-display text-4xl md:text-5xl bg-transparent text-fg tracking-wider border-b-2 border-accent outline-none w-full"
              style={{ fontSize: '2.5rem', lineHeight: 1 }}
            />
          ) : (
            <div className="flex items-center gap-2">
              <h1
                className={`font-display text-4xl md:text-5xl text-fg tracking-wider ${
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
            {playlist.songs.length} {playlist.songs.length === 1 ? 'track' : 'tracks'}
            {' • '}
            {user?.discordId === playlist.createdBy
              ? 'Created by you'
              : `Created by ${playlist.createdByDisplayName || playlist.createdBy}`}
          </p>
        </div>

        <div className="flex gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            className="btn-ghost text-xs flex items-center gap-1.5"
            onClick={() => handleAddPlaylistToQueue()}
            disabled={playlist.songs.length === 0}
            title="Add playlist to current queue"
          >
            <PlusCircleIcon size={14} weight="duotone" /> Add to Queue
          </button>
          <button
            type="button"
            className="btn-primary text-xs flex items-center gap-1.5"
            onClick={() => setShowPlay(true)}
            disabled={playlist.songs.length === 0}
          >
            <PlayIcon size={14} weight="duotone" /> Play
          </button>
          {(user?.discordId === playlist.createdBy || isAdminView) && (
            <button
              type="button"
              className="btn-ghost text-xs flex items-center gap-1.5"
              onClick={handleToggleVisibility}
              title={playlist.isPrivate ? 'Make playlist public' : 'Make playlist private'}
            >
              {playlist.isPrivate ? (
                <>
                  {' '}
                  <LockOpenIcon size={14} weight="duotone" className="inline mr-1" /> Make Public{' '}
                </>
              ) : (
                <>
                  {' '}
                  <LockIcon size={14} weight="duotone" className="inline mr-1" /> Make Private{' '}
                </>
              )}
            </button>
          )}
          {(isAdminView || isOwner) && (
            <>
              {isEditMode && (
                <>
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    onClick={() => setShowAddSongs(true)}
                  >
                    + Add Songs
                  </button>
                  <button
                    type="button"
                    className="btn-danger text-xs"
                    onClick={handleDeletePlaylist}
                  >
                    Delete
                  </button>
                </>
              )}
              <button
                type="button"
                className={`btn-ghost text-xs ${isEditMode ? 'text-accent' : ''}`}
                onClick={toggleEditMode}
              >
                {isEditMode ? '✎ Editing' : '✎ Edit'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Song list */}
      {playlist.songs.length === 0 ? (
        <EmptyState isAdmin={canEdit} onAdd={() => setShowAddSongs(true)} />
      ) : (
        <div className="space-y-1">
          {playlist.songs.map((ps, i) => (
            <SongRow
              key={ps.id}
              position={i + 1}
              song={ps.song}
              isAdmin={canEdit}
              onRemove={() => setRemoveId(ps.songId)}
              onPlay={() => handlePlayFromSong(ps.songId)}
              isPlaying={playingSongId === ps.songId}
              onAddToQueue={() => handleAddToQueue(ps.songId)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showAddSongs && (
        <AddSongsModal
          playlist={playlist}
          onClose={() => setShowAddSongs(false)}
          onAdded={() => {
            load();
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
  onPlay,
  isPlaying,
  onAddToQueue,
}: {
  position: number;
  song: Song;
  isAdmin: boolean;
  onRemove: () => void;
  onPlay: () => void;
  isPlaying?: boolean;
  onAddToQueue: () => void;
}) {
  return (
    <div className="flex items-center gap-2 md:gap-4 px-3 md:px-4 py-3 rounded-lg group hover:bg-elevated active:bg-elevated/80 transition-colors duration-100">
      <div className="w-8 md:w-6 shrink-0 flex justify-end">
        <span
          className={`font-mono text-xs text-faint text-right ${
            isPlaying ? 'hidden' : 'group-hover:hidden'
          }`}
        >
          {position}
        </span>
        {isPlaying ? (
          <span className="flex items-center justify-center">
            <span className="animate-pulse text-accent text-xs">●</span>
          </span>
        ) : (
          <button
            type="button"
            onClick={onPlay}
            className="hidden md:group-hover:flex items-center justify-center text-accent hover:text-accent/80 active:text-accent-muted transition-colors duration-150 w-11 h-11 md:w-auto md:h-auto"
            title="Play from this song"
          >
            <PlayIcon size={16} weight="duotone" className="md:w-3.5 md:h-3.5" />
          </button>
        )}
      </div>
      <img
        src={song.thumbnailUrl}
        alt={song.nickname || song.title}
        className="w-12 h-8 md:w-10 md:h-7 object-cover rounded border border-border shrink-0"
        loading="lazy"
      />
      <div className="flex-1 min-w-0">
        <p className="font-body text-sm font-medium text-fg truncate">
          {song.nickname || song.title}
        </p>
        {song.nickname && <p className="font-mono text-[10px] text-muted truncate">{song.title}</p>}
      </div>
      <span className="font-mono text-xs text-muted shrink-0">{formatDuration(song.duration)}</span>
      {/* Add to Queue - available to all members */}
      <button
        type="button"
        onClick={onAddToQueue}
        className="opacity-100 md:opacity-0 md:group-hover:opacity-100 flex items-center justify-center text-muted hover:text-accent active:bg-accent/10 transition-all duration-150 p-2.5 md:p-1 rounded-xl"
        title="Add to Up Next"
      >
        <VinylRecordIcon size={18} weight="duotone" className="md:w-3.5 md:h-3.5" />
      </button>
      {isAdmin && (
        <button
          type="button"
          onClick={onRemove}
          className="opacity-100 md:opacity-0 md:group-hover:opacity-100 flex items-center justify-center text-faint hover:text-danger active:bg-danger/10 transition-all duration-150 p-2.5 md:p-1 rounded-xl"
          title="Remove from playlist"
        >
          <BombIcon size={18} weight="duotone" className="md:w-3.5 md:h-3.5" />
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
  const [added, setAdded] = useState<Set<string>>(new Set(playlist.songs.map((ps) => ps.songId)));
  const [search, setSearch] = useState('');

  useEffect(() => {
    getSongs().then((s) => {
      setAllSongs(s);
      setLoading(false);
    });
  }, []);

  const filtered = allSongs.filter((s) => s.title.toLowerCase().includes(search.toLowerCase()));

  const handleAdd = async (song: Song) => {
    setAdding((prev) => new Set([...prev, song.id]));
    try {
      await addSongToPlaylist(playlist.id, song.id);
      setAdded((prev) => new Set([...prev, song.id]));
    } catch {
      /* already added — mark as added */
      setAdded((prev) => new Set([...prev, song.id]));
    } finally {
      setAdding((prev) => {
        const n = new Set(prev);
        n.delete(song.id);
        return n;
      });
    }
  };

  const hasAddedNew = added.size > playlist.songs.length;

  return (
    <Backdrop onClose={onClose}>
      <div
        className="bg-surface border border-border rounded-xl w-full max-w-lg shadow-2xl
 flex flex-col max-h-[80vh] animate-fade-up"
      >
        <div className="p-4 md:p-5 border-b border-border">
          <h2 className="font-display text-2xl md:text-3xl text-fg tracking-wider">Add Songs</h2>
          <p className="font-mono text-xs text-muted mt-0.5">to "{playlist.name}"</p>
          <input
            className="input mt-3 md:mt-4"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 md:p-6 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={`skeleton-${i}`} className="flex items-center gap-3">
                  <div className="skeleton w-12 h-8 md:w-10 md:h-7 rounded" />
                  <div className="skeleton h-3 flex-1" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-4 md:p-6 font-mono text-xs text-muted text-center">no songs found</p>
          ) : (
            filtered.map((song) => {
              const isAdded = added.has(song.id);
              const isAdding = adding.has(song.id);
              return (
                <div
                  key={song.id}
                  className="flex items-center gap-2 md:gap-3 px-4 md:px-5 py-3 hover:bg-elevated active:bg-elevated/80 transition-colors duration-100"
                >
                  <img
                    src={song.thumbnailUrl}
                    alt={song.nickname || song.title}
                    className="w-12 h-8 md:w-10 md:h-7 object-cover rounded border border-border shrink-0"
                    loading="lazy"
                  />
                  <span className="flex-1 font-body text-sm text-fg truncate">
                    {song.nickname || song.title}
                  </span>
                  <span className="font-mono text-xs text-muted hidden sm:block">
                    {formatDuration(song.duration)}
                  </span>
                  <button
                    type="button"
                    disabled={isAdded || isAdding}
                    onClick={() => handleAdd(song)}
                    className={`font-mono text-xs px-3 py-2 md:py-1 rounded-xl border transition-colors duration-150 min-h-11 md:min-h-0 ${
                      isAdded
                        ? 'border-accent/30 text-accent bg-accent/5 cursor-default'
                        : 'border-border text-muted hover:border-accent/40 hover:text-accent active:bg-accent/10'
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
          <button type="button" className="btn-primary" onClick={hasAddedNew ? onAdded : onClose}>
            {hasAddedNew ? 'Done' : 'Close'}
          </button>
        </div>
      </div>
    </Backdrop>
  );
}

// ---------------------------------------------------------------------------
// Play modal — mode selector
// ---------------------------------------------------------------------------
function PlayModal({
  onClose,
  onPlay,
}: {
  onClose: () => void;
  onPlay: (mode: 'sequential' | 'random') => void;
}) {
  const [mode, setMode] = useState<'sequential' | 'random'>('sequential');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePlay = async () => {
    setLoading(true);
    setError('');
    try {
      await onPlay(mode);
      onClose();
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Could not start playback. Is the bot in a voice channel?'));
      setLoading(false);
    }
  };

  return (
    <Backdrop onClose={onClose}>
      <div className="bg-surface border border-border rounded-xl p-5 md:p-6 w-full max-w-sm mx-4 shadow-2xl animate-fade-up">
        <h2 className="font-display text-2xl md:text-3xl text-fg tracking-wider mb-1">
          Play Playlist
        </h2>
        <p className="font-mono text-xs text-muted mb-6">configure playback</p>

        <div className="mb-6">
          <p className="font-mono text-xs text-muted mb-2 uppercase tracking-widest">Order</p>
          <div className="flex gap-2">
            {(['sequential', 'random'] as const).map((m) => (
              <button
                type="button"
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

        {error && <p className="font-mono text-xs text-danger mb-4">{error}</p>}

        <div className="flex gap-2 justify-end">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={handlePlay} disabled={loading}>
            {loading ? (
              'Starting...'
            ) : (
              <>
                {' '}
                <PlayCircleIcon size={12} weight="duotone" className="inline mr-1" /> Play{' '}
              </>
            )}
          </button>
        </div>
      </div>
    </Backdrop>
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

function EmptyState({ isAdmin, onAdd }: { isAdmin: boolean; onAdd: () => void }) {
  return (
    <div className="text-center py-24">
      <p className="font-display text-4xl text-faint tracking-wider mb-2">Empty Playlist</p>
      {isAdmin ? (
        <p className="font-mono text-xs text-faint">
          <button type="button" className="text-accent hover:underline" onClick={onAdd}>
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

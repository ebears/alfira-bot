import type { Playlist, Song } from '@alfira-bot/shared';
import { formatDuration } from '@alfira-bot/shared';
import {
  BombIcon,
  CassetteTapeIcon,
  CircleNotchIcon,
  ListIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  PlayIcon,
  SquaresFourIcon,
  UserIcon,
  VinylRecordIcon,
} from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addSong,
  addSongToPlaylist,
  deleteSong,
  getPlaylists,
  getSongs,
  importPlaylist,
  startPlayback,
  updateSongNickname,
} from '../api/api';
import { Backdrop } from '../components/Backdrop';
import ConfirmModal from '../components/ConfirmModal';
import NotificationToast from '../components/NotificationToast';
import { useAdminView } from '../context/AdminViewContext';
import { usePlayer } from '../context/PlayerContext';
import { useAddToQueue } from '../hooks/useAddToQueue';
import { useNotification } from '../hooks/useNotification';
import { usePlaylistUrlDetection } from '../hooks/usePlaylistUrlDetection';
import { useSocket } from '../hooks/useSocket';
import { apiErrorMessage } from '../utils/api';

export default function SongsPage() {
  const { isAdminView } = useAdminView();
  const socket = useSocket();
  const { state: queueState } = usePlayer();
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const { notification, notify } = useNotification();
  const handleAddToQueue = useAddToQueue(notify);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    const saved = localStorage.getItem('alfira-library-view');
    return saved === 'list' ? 'list' : 'grid';
  });

  const toggleViewMode = useCallback((mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('alfira-library-view', mode);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([getSongs(), getPlaylists()]);
      setSongs(s);
      setPlaylists(p);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handleSongAdded = (song: Song) => {
      setSongs((prev) => {
        if (prev.some((s) => s.id === song.id)) return prev;
        return [song, ...prev];
      });
    };

    const handleSongDeleted = (id: string) => {
      setSongs((prev) => prev.filter((s) => s.id !== id));
    };

    const handleSongUpdated = (updatedSong: Song) => {
      setSongs((prev) =>
        prev.map((s) =>
          s.id === updatedSong.id ? { ...updatedSong, addedByDisplayName: s.addedByDisplayName } : s
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
  }, [socket]);

  const handleDelete = async (id: string) => {
    await deleteSong(id);
    setDeleteId(null);
    // Socket event will update the songs list
  };

  const q = search.toLowerCase();
  const filtered = songs.filter(
    (s) => s.title.toLowerCase().includes(q) || s.nickname?.toLowerCase().includes(q)
  );

  // ---------------------------------------------------------------------------
  // Play from song — replaces the queue with the full library starting from
  // the clicked song, then continues sequentially through the rest.
  // ---------------------------------------------------------------------------

  const handlePlayFromSong = async (songId: string) => {
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
  };

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="font-display text-4xl md:text-5xl text-fg tracking-wider">Library</h1>
          <p className="font-mono text-xs text-muted mt-1">
            {loading ? '—' : `${songs.length} track${songs.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {isAdminView && (
          <button type="button" className="btn-primary" onClick={() => setShowAddModal(true)}>
            + Add Song
          </button>
        )}
      </div>

      {/* Search and view toggle */}
      <div className="flex items-center gap-2 mb-4 md:mb-6">
        <div className="relative flex-1">
          <MagnifyingGlassIcon
            className="absolute left-3 top-1/2 -translate-y-1/2 text-faint w-4 h-4 md:w-3.5 md:h-3.5"
            size={16}
            weight="duotone"
          />
          <input
            className="input pl-10"
            placeholder="Search by title or nickname..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {/* View toggle */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => toggleViewMode('grid')}
            className={`flex items-center justify-center w-9 h-9 rounded-lg border transition-colors duration-150 ${
              viewMode === 'grid'
                ? 'border-accent text-accent bg-accent/10'
                : 'border-border text-muted hover:text-fg hover:border-border/80'
            }`}
            title="Grid view"
          >
            <SquaresFourIcon size={18} weight="duotone" />
          </button>
          <button
            type="button"
            onClick={() => toggleViewMode('list')}
            className={`flex items-center justify-center w-9 h-9 rounded-lg border transition-colors duration-150 ${
              viewMode === 'list'
                ? 'border-accent text-accent bg-accent/10'
                : 'border-border text-muted hover:text-fg hover:border-border/80'
            }`}
            title="List view"
          >
            <ListIcon size={18} weight="duotone" />
          </button>
        </div>
      </div>

      {/* Song list */}
      {loading ? (
        <SkeletonGrid />
      ) : filtered.length === 0 ? (
        <EmptyState search={search} isAdmin={isAdminView} onAdd={() => setShowAddModal(true)} />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3 md:gap-4">
          {filtered.map((song, i) => (
            <SongCard
              key={song.id}
              song={song}
              isAdmin={isAdminView}
              playlists={playlists}
              style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
              onDelete={() => setDeleteId(song.id)}
              onPlay={() => handlePlayFromSong(song.id)}
              isPlaying={playingId === song.id}
              onAddToQueue={() => handleAddToQueue(song.id)}
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
              onDelete={() => setDeleteId(song.id)}
              onPlay={() => handlePlayFromSong(song.id)}
              isPlaying={playingId === song.id}
              onAddToQueue={() => handleAddToQueue(song.id)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddSongModal
          onClose={() => setShowAddModal(false)}
          onAdded={(song) => {
            setSongs((prev) => {
              if (prev.some((s) => s.id === song.id)) return prev;
              return [song, ...prev];
            });
            setShowAddModal(false);
          }}
        />
      )}

      {deleteId &&
        (() => {
          const songToDelete = songs.find((s) => s.id === deleteId);
          return songToDelete ? (
            <ConfirmModal
              title="Delete Song"
              message={
                <>
                  Remove{' '}
                  <span className="text-fg font-semibold">
                    "{songToDelete.nickname || songToDelete.title}"
                  </span>{' '}
                  from the library?{' '}
                  <span className="font-mono text-xs text-danger/70">
                    this will remove it from all playlists too.
                  </span>
                </>
              }
              confirmLabel="Delete"
              onConfirm={() => handleDelete(deleteId)}
              onCancel={() => setDeleteId(null)}
            />
          ) : null;
        })()}

      {/* Notification Toast */}
      {notification && <NotificationToast notification={notification} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Song card
// ---------------------------------------------------------------------------
function SongCard({
  song,
  isAdmin,
  playlists,
  style,
  onDelete,
  onPlay,
  isPlaying,
  onAddToQueue,
}: {
  song: Song;
  isAdmin: boolean;
  playlists: Playlist[];
  style?: React.CSSProperties;
  onDelete: () => void;
  onPlay: () => void;
  isPlaying: boolean;
  onAddToQueue: () => void;
}) {
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [addingToPlaylist, setAddingToPlaylist] = useState<string | null>(null);
  const [addedTo, setAddedTo] = useState<Set<string>>(new Set());
  const [addingToQueue, setAddingToQueue] = useState(false);
  const [editingNickname, setEditingNickname] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [savingNickname, setSavingNickname] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingNickname) editInputRef.current?.focus();
  }, [editingNickname]);

  const startEdit = () => {
    setEditValue(song.nickname || '');
    setEditingNickname(true);
  };

  const cancelEdit = () => {
    setEditingNickname(false);
    setEditValue('');
  };

  const saveNickname = async () => {
    setSavingNickname(true);
    try {
      await updateSongNickname(song.id, editValue.trim() || null);
      setEditingNickname(false);
    } finally {
      setSavingNickname(false);
    }
  };

  // Close playlist menu when clicking outside
  useEffect(() => {
    if (!showPlaylistMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowPlaylistMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPlaylistMenu]);

  const handleAddToPlaylist = async (playlistId: string) => {
    setAddingToPlaylist(playlistId);
    try {
      await addSongToPlaylist(playlistId, song.id);
      setAddedTo((prev) => new Set([...prev, playlistId]));
    } catch (err: unknown) {
      if (apiErrorMessage(err, '').includes('already')) {
        setAddedTo((prev) => new Set([...prev, playlistId]));
      }
    } finally {
      setAddingToPlaylist(null);
    }
  };

  const handleAddToQueue = async () => {
    setAddingToQueue(true);
    try {
      await onAddToQueue();
    } finally {
      setAddingToQueue(false);
    }
  };

  return (
    <div
      className="card group animate-fade-up opacity-0 flex flex-col hover:border-border/80 hover:bg-elevated transition-colors duration-150"
      style={style}
    >
      {/* Thumbnail with play overlay */}
      <div className="relative aspect-video bg-elevated overflow-hidden">
        <img
          src={song.thumbnailUrl}
          alt={song.nickname || song.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
        <span className="absolute bottom-2 right-2 font-mono text-[10px] text-white/80 bg-black/50 px-1.5 py-0.5 rounded">
          {formatDuration(song.duration)}
        </span>

        {/* Play button overlay — visible on hover or while loading */}
        <button
          type="button"
          onClick={onPlay}
          disabled={isPlaying}
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
            isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 md:opacity-0'
          } disabled:cursor-default`}
          title="Play from this song"
        >
          <div
            className={`w-14 h-14 md:w-12 md:h-12 rounded-full bg-black/60 border border-white/20 backdrop-blur-sm flex items-center justify-center shadow-xl transition-transform duration-150 ${
              isPlaying ? 'scale-100' : 'scale-90 group-hover:scale-100'
            }`}
          >
            {isPlaying ? (
              <CircleNotchIcon
                size={24}
                weight="bold"
                className="text-accent animate-spin md:w-5 md:h-5"
              />
            ) : (
              <PlayIcon size={24} weight="duotone" className="text-white md:w-5 md:h-5" />
            )}
          </div>
        </button>
      </div>

      {/* Info */}
      <div className="p-3 flex-1 flex flex-col gap-2">
        {editingNickname ? (
          <div className="flex items-center gap-1.5">
            <input
              className="input text-sm py-1 px-2 flex-1 min-w-0"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveNickname();
                if (e.key === 'Escape') cancelEdit();
              }}
              disabled={savingNickname}
              ref={editInputRef}
              placeholder="Nickname (empty to clear)"
            />
            <button
              type="button"
              onClick={saveNickname}
              disabled={savingNickname}
              className="text-xs text-accent hover:text-accent/80 shrink-0"
            >
              {savingNickname ? '...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="text-xs text-muted hover:text-fg shrink-0"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <p className="font-body font-semibold text-sm text-fg leading-tight line-clamp-2">
              {song.nickname || song.title}
            </p>
            {song.nickname && (
              <p className="text-[11px] text-faint truncate opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                {song.title}
              </p>
            )}
          </>
        )}
        <span className="flex items-center gap-1 text-[10px] text-faint opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <UserIcon size={12} weight="duotone" />
          {song.addedByDisplayName || song.addedBy}
        </span>
        <div className="flex gap-1.5 mt-auto pt-1">
          {/* Add to Queue - available to all members */}
          <button
            type="button"
            onClick={handleAddToQueue}
            disabled={addingToQueue}
            className="flex items-center justify-center w-11 h-11 md:w-8 md:h-8 text-muted hover:text-accent active:bg-accent/10 border border-border hover:border-accent/30 rounded-xl transition-colors duration-150 disabled:opacity-50"
            title="Add to Up Next"
          >
            {addingToQueue ? (
              <span className="w-4 h-4 md:w-3 md:h-3 border-2 md:border border-accent border-t-transparent rounded-full animate-spin inline-block" />
            ) : (
              <VinylRecordIcon size={18} weight="duotone" className="md:w-4 md:h-4" />
            )}
          </button>
          {isAdmin && (
            <>
              {/* Add to playlist */}
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setShowPlaylistMenu((p) => !p)}
                  className="flex items-center justify-center w-11 h-11 md:w-8 md:h-8 text-muted hover:text-fg active:bg-elevated border border-border hover:border-accent/30 rounded-xl transition-colors duration-150"
                  title="Add to playlist"
                >
                  <CassetteTapeIcon size={18} weight="duotone" className="md:w-4 md:h-4" />
                </button>
                {showPlaylistMenu && (
                  <div className="absolute bottom-full left-0 mb-1 w-44 bg-elevated border border-border rounded shadow-xl z-20 overflow-hidden">
                    {playlists.length === 0 ? (
                      <p className="px-3 py-2 text-xs font-mono text-muted">no playlists yet</p>
                    ) : (
                      playlists.map((pl) => (
                        <button
                          type="button"
                          key={pl.id}
                          disabled={addingToPlaylist === pl.id || addedTo.has(pl.id)}
                          onClick={() => handleAddToPlaylist(pl.id)}
                          className="w-full text-left px-3 py-2 text-xs font-body text-fg hover:bg-border/50 transition-colors duration-100 disabled:opacity-50 flex items-center justify-between"
                        >
                          <span className="truncate">{pl.name}</span>
                          {addedTo.has(pl.id) && (
                            <span className="text-accent text-[10px] ml-1">✓</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {/* Edit nickname */}
              <button
                type="button"
                onClick={startEdit}
                className="flex items-center justify-center w-11 h-11 md:w-8 md:h-8 text-muted hover:text-accent active:bg-accent/10 border border-border hover:border-accent/30 rounded-xl transition-colors duration-150"
                title="Edit nickname"
              >
                <PencilSimpleIcon size={18} weight="duotone" className="md:w-4 md:h-4" />
              </button>
              {/* Delete */}
              <button
                type="button"
                onClick={onDelete}
                className="flex items-center justify-center w-11 h-11 md:w-8 md:h-8 text-faint hover:text-danger active:bg-danger/10 border border-border hover:border-danger/30 rounded-xl transition-colors duration-150"
                title="Delete song"
              >
                <BombIcon size={18} weight="duotone" className="md:w-4 md:h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Song row (list view)
// ---------------------------------------------------------------------------
function LibrarySongRow({
  song,
  isAdmin,
  onDelete,
  onPlay,
  isPlaying,
  onAddToQueue,
}: {
  song: Song;
  isAdmin: boolean;
  onDelete: () => void;
  onPlay: () => void;
  isPlaying: boolean;
  onAddToQueue: () => void;
}) {
  const [editingNickname, setEditingNickname] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [savingNickname, setSavingNickname] = useState(false);
  const [addingToQueue, setAddingToQueue] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingNickname) editInputRef.current?.focus();
  }, [editingNickname]);

  const startEdit = () => {
    setEditValue(song.nickname || '');
    setEditingNickname(true);
  };

  const cancelEdit = () => {
    setEditingNickname(false);
    setEditValue('');
  };

  const saveNickname = async () => {
    setSavingNickname(true);
    try {
      await updateSongNickname(song.id, editValue.trim() || null);
      setEditingNickname(false);
    } finally {
      setSavingNickname(false);
    }
  };

  const handleAddToQueue = async () => {
    setAddingToQueue(true);
    try {
      await onAddToQueue();
    } finally {
      setAddingToQueue(false);
    }
  };

  return (
    <div className="flex items-center gap-2 md:gap-4 px-3 md:px-4 py-3 rounded-lg group hover:bg-elevated active:bg-elevated/80 transition-colors duration-100">
      <img
        src={song.thumbnailUrl}
        alt={song.nickname || song.title}
        className="w-20 h-12 md:w-16 md:h-10 object-cover rounded border border-border shrink-0"
        loading="lazy"
      />
      <div className="flex-1 min-w-0">
        {editingNickname ? (
          <div className="flex items-center gap-1.5">
            <input
              className="input text-sm py-1 px-2 flex-1 min-w-0"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveNickname();
                if (e.key === 'Escape') cancelEdit();
              }}
              disabled={savingNickname}
              ref={editInputRef}
              placeholder="Nickname (empty to clear)"
            />
            <button
              type="button"
              onClick={saveNickname}
              disabled={savingNickname}
              className="text-xs text-accent hover:text-accent/80 shrink-0"
            >
              {savingNickname ? '...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="text-xs text-muted hover:text-fg shrink-0"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <p className="font-body text-sm font-medium text-fg truncate">
              {song.nickname || song.title}
            </p>
            {song.nickname && (
              <p className="font-mono text-[10px] text-muted truncate">{song.title}</p>
            )}
          </>
        )}
      </div>
      <span className="flex items-center gap-1 text-[10px] text-faint shrink-0">
        <UserIcon size={12} weight="duotone" />
        {song.addedByDisplayName || song.addedBy}
      </span>
      <span className="font-mono text-xs text-muted shrink-0">{formatDuration(song.duration)}</span>
      <button
        type="button"
        onClick={onPlay}
        disabled={isPlaying}
        className="opacity-100 md:opacity-0 md:group-hover:opacity-100 flex items-center justify-center text-muted hover:text-accent active:bg-accent/10 transition-all duration-150 p-2.5 md:p-1 rounded-xl disabled:opacity-50"
        title="Play from this song"
      >
        {isPlaying ? (
          <CircleNotchIcon size={18} weight="bold" className="animate-spin" />
        ) : (
          <PlayIcon size={18} weight="duotone" />
        )}
      </button>
      <button
        type="button"
        onClick={handleAddToQueue}
        disabled={addingToQueue}
        className="opacity-100 md:opacity-0 md:group-hover:opacity-100 flex items-center justify-center text-muted hover:text-accent active:bg-accent/10 transition-all duration-150 p-2.5 md:p-1 rounded-xl disabled:opacity-50"
        title="Add to Up Next"
      >
        {addingToQueue ? (
          <span className="w-4 h-4 border border-accent border-t-transparent rounded-full animate-spin inline-block" />
        ) : (
          <VinylRecordIcon size={18} weight="duotone" />
        )}
      </button>
      {isAdmin && (
        <>
          <button
            type="button"
            onClick={startEdit}
            className="opacity-100 md:opacity-0 md:group-hover:opacity-100 flex items-center justify-center text-muted hover:text-accent active:bg-accent/10 transition-all duration-150 p-2.5 md:p-1 rounded-xl"
            title="Edit nickname"
          >
            <PencilSimpleIcon size={18} weight="duotone" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="opacity-100 md:opacity-0 md:group-hover:opacity-100 flex items-center justify-center text-faint hover:text-danger active:bg-danger/10 transition-all duration-150 p-2.5 md:p-1 rounded-xl"
            title="Delete song"
          >
            <BombIcon size={18} weight="duotone" />
          </button>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Song modal
// ---------------------------------------------------------------------------
function AddSongModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (song: Song) => void;
}) {
  const [url, setUrl] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const { isPlaylist, importFullPlaylist, setImportFullPlaylist } = usePlaylistUrlDetection(url);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      if (importFullPlaylist) {
        // Import playlist
        const result = await importPlaylist(url.trim());
        setSuccessMsg(result.message);
        // Close modal after a short delay to show success message
        // The socket events will update the song list automatically
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        // Add single song
        const song = await addSong(url.trim(), nickname.trim() || undefined);
        onAdded(song);
      }
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Something went wrong. Try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') onClose();
  };

  return (
    <Backdrop onClose={onClose}>
      <div className="bg-surface border border-border rounded-xl p-5 md:p-6 w-full max-w-md mx-4 shadow-2xl animate-fade-up">
        <h2 className="font-display text-2xl md:text-3xl text-fg tracking-wider mb-1">Add Song</h2>
        <p className="font-mono text-xs text-muted mb-4 md:mb-6">paste a youtube url</p>

        <input
          ref={inputRef}
          className="input mb-3"
          placeholder="https://youtube.com/watch?v=..."
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError('');
            setSuccessMsg('');
          }}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />

        {isPlaylist && (
          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={importFullPlaylist}
              onChange={(e) => setImportFullPlaylist(e.target.checked)}
              disabled={loading}
              className="w-4 h-4 rounded border-border bg-surface accent-accent"
            />
            <span className="font-mono text-xs text-fg">Import full playlist</span>
          </label>
        )}

        {!importFullPlaylist && (
          <input
            className="input mb-3"
            placeholder="Nickname (optional)"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            disabled={loading}
          />
        )}

        {error && <p className="font-mono text-xs text-danger mb-3">{error}</p>}

        {successMsg && <p className="font-mono text-xs text-success mb-3">{successMsg}</p>}

        {loading && (
          <p className="font-mono text-xs text-muted mb-3 flex items-center gap-2">
            <span className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin inline-block" />
            {importFullPlaylist ? 'importing playlist...' : 'fetching metadata...'}
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSubmit}
            disabled={loading || !url.trim()}
          >
            {importFullPlaylist ? 'Import' : 'Add'}
          </button>
        </div>
      </div>
    </Backdrop>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loading grid
// ---------------------------------------------------------------------------
function SkeletonGrid() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="card">
          <div className="skeleton aspect-video" />
          <div className="p-3 space-y-2">
            <div className="skeleton h-3 w-3/4" />
            <div className="skeleton h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyState({
  search,
  isAdmin,
  onAdd,
}: {
  search: string;
  isAdmin: boolean;
  onAdd: () => void;
}) {
  if (search) {
    return (
      <div className="text-center py-24">
        <p className="font-display text-4xl text-faint tracking-wider mb-2">No Results</p>
        <p className="font-mono text-xs text-faint">no songs match "{search}"</p>
      </div>
    );
  }

  return (
    <div className="text-center py-24">
      <p className="font-display text-4xl text-faint tracking-wider mb-2">Empty Library</p>
      {isAdmin ? (
        <p className="font-mono text-xs text-faint">
          <button type="button" className="text-accent hover:underline" onClick={onAdd}>
            add the first song
          </button>{' '}
          to get started
        </p>
      ) : (
        <p className="font-mono text-xs text-faint">no songs have been added yet</p>
      )}
    </div>
  );
}

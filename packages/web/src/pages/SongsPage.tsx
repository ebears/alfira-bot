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
} from '../api/api';
import { Backdrop } from '../components/Backdrop';
import ConfirmModal from '../components/ConfirmModal';
import type { MenuItem } from '../components/ContextMenu';
import { ContextMenu, ContextMenuTrigger } from '../components/ContextMenu';
import NotificationToast from '../components/NotificationToast';
import { useAdminView } from '../context/AdminViewContext';
import { usePlayer } from '../context/PlayerContext';
import { useAddToQueue } from '../hooks/useAddToQueue';
import { useNicknameEditor } from '../hooks/useNicknameEditor';
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
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
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

  useEffect(() => {
    if (!activeCardId) return;
    const handler = () => setActiveCardId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [activeCardId]);

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
              isActive={activeCardId === song.id}
              onToggleActive={() => setActiveCardId(activeCardId === song.id ? null : song.id)}
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
  isActive,
  onToggleActive,
}: {
  song: Song;
  isAdmin: boolean;
  playlists: Playlist[];
  style?: React.CSSProperties;
  onDelete: () => void;
  onPlay: () => void;
  isPlaying: boolean;
  onAddToQueue: () => void;
  isActive: boolean;
  onToggleActive: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [addedTo, setAddedTo] = useState<Set<string>>(new Set());
  const [addingToQueue, setAddingToQueue] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const {
    editingNickname,
    editValue,
    setEditValue,
    savingNickname,
    editInputRef,
    startEdit,
    cancelEdit,
    saveNickname,
  } = useNicknameEditor(song.id, song.nickname);

  const handleAddToPlaylist = async (playlistId: string) => {
    try {
      await addSongToPlaylist(playlistId, song.id);
      setAddedTo((prev) => new Set([...prev, playlistId]));
    } catch (err: unknown) {
      if (apiErrorMessage(err, '').includes('already')) {
        setAddedTo((prev) => new Set([...prev, playlistId]));
      }
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

  const menuItems: MenuItem[] = isAdmin
    ? [
        {
          id: 'add-to-playlist',
          label: 'Add to playlist',
          icon: <CassetteTapeIcon size={14} weight="duotone" />,
          submenu: {
            title: 'Add to playlist',
            items: playlists.map((pl) => ({
              id: pl.id,
              label: pl.name,
              disabled: addedTo.has(pl.id),
            })),
            onSelect: handleAddToPlaylist,
            emptyMessage: 'no playlists yet',
          },
        },
        {
          id: 'edit-nickname',
          label: 'Edit nickname',
          icon: <PencilSimpleIcon size={14} weight="duotone" />,
          onClick: startEdit,
        },
        {
          id: 'delete',
          label: 'Delete song',
          icon: <BombIcon size={14} weight="duotone" />,
          danger: true,
          onClick: onDelete,
        },
      ]
    : [];

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

        {/* Mobile tap target — invisible overlay that toggles active state */}
        <div
          className="absolute inset-0 z-10 md:pointer-events-none"
          onClick={(e) => {
            if (e.target !== e.currentTarget) return;
            e.stopPropagation();
            onToggleActive();
          }}
        />

        {/* Duration badge — bottom right */}
        <span className="absolute bottom-2 right-2 z-20 font-mono text-[10px] text-white/80 bg-black/50 px-1.5 py-0.5 rounded">
          {formatDuration(song.duration)}
        </span>

        {/* Play button — center (rendered before action buttons so they receive clicks) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPlay();
          }}
          disabled={isPlaying}
          className={`
            absolute inset-0 z-[15] flex items-center justify-center
            transition-opacity duration-200
            ${isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto'}
            ${isActive && !isPlaying ? '!opacity-100 !pointer-events-auto' : ''}
            disabled:cursor-default
          `}
          title="Play from this song"
        >
          <div
            className={`btn-primary flex items-center gap-2 px-5 py-2.5 text-sm transition-transform duration-150 ${
              isPlaying ? 'scale-100' : 'scale-90 group-hover:scale-100'
            }`}
          >
            {isPlaying ? (
              <CircleNotchIcon size={18} weight="bold" className="animate-spin" />
            ) : (
              <>
                <PlayIcon size={18} weight="duotone" />
                <span className="hidden md:inline">Play</span>
              </>
            )}
          </div>
        </button>

        {/* Add to Queue — top left */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleAddToQueue();
          }}
          disabled={addingToQueue}
          className={`
            absolute top-2 left-2 z-20
            flex items-center justify-center w-8 h-8 rounded-xl
            bg-black/50 backdrop-blur-sm border border-white/15
            text-white/70 hover:text-white
            transition-all duration-200
            opacity-0 pointer-events-none
            group-hover:opacity-100 group-hover:pointer-events-auto
            ${isActive ? '!opacity-100 !pointer-events-auto' : ''}
            disabled:opacity-50
          `}
          title="Add to Up Next"
        >
          {addingToQueue ? (
            <span className="w-3.5 h-3.5 border-2 border-white/70 border-t-transparent rounded-full animate-spin inline-block" />
          ) : (
            <VinylRecordIcon size={16} weight="duotone" />
          )}
        </button>

        {/* Context menu trigger — top right */}
        {menuItems.length > 0 && (
          <>
            <div
              className={`
              absolute top-2 right-2 z-20
              transition-all duration-200
              opacity-0 pointer-events-none
              group-hover:opacity-100 group-hover:pointer-events-auto
              ${isActive ? '!opacity-100 !pointer-events-auto' : ''}
              ${menuOpen ? '!opacity-100' : ''}
            `}
            >
              <ContextMenuTrigger
                ref={triggerRef}
                onOpen={() => setMenuOpen(true)}
                isOpen={menuOpen}
                className="!w-8 !h-8 md:!w-8 md:!h-8 !text-white/70 hover:!text-white !border-white/15 hover:!border-white/30 !bg-black/50 !backdrop-blur-sm !rounded-xl !opacity-100 md:!opacity-100"
              />
            </div>
            {menuOpen && (
              <ContextMenu
                items={menuItems}
                isOpen={menuOpen}
                onClose={() => setMenuOpen(false)}
                triggerRef={triggerRef}
              />
            )}
          </>
        )}

        {/* Added by — bottom left */}
        <span
          className={`
          absolute bottom-2 left-2 z-20
          flex items-center gap-1
          text-[10px] text-white/80 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded
          transition-opacity duration-200
          opacity-0 pointer-events-none
          group-hover:opacity-100 group-hover:pointer-events-auto
          ${isActive ? '!opacity-100 !pointer-events-auto' : ''}
        `}
        >
          <UserIcon size={10} weight="duotone" />
          {song.addedByDisplayName || song.addedBy}
        </span>
      </div>

      {/* Info */}
      <div className="p-3 flex-1">
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [addingToQueue, setAddingToQueue] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const {
    editingNickname,
    editValue,
    setEditValue,
    savingNickname,
    editInputRef,
    startEdit,
    cancelEdit,
    saveNickname,
  } = useNicknameEditor(song.id, song.nickname);

  const handleAddToQueue = async () => {
    setAddingToQueue(true);
    try {
      await onAddToQueue();
    } finally {
      setAddingToQueue(false);
    }
  };

  const menuItems: MenuItem[] = isAdmin
    ? [
        {
          id: 'edit-nickname',
          label: 'Edit nickname',
          icon: <PencilSimpleIcon size={14} weight="duotone" />,
          onClick: startEdit,
        },
        {
          id: 'delete',
          label: 'Delete song',
          icon: <BombIcon size={14} weight="duotone" />,
          danger: true,
          onClick: onDelete,
        },
      ]
    : [];

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
      {menuItems.length > 0 && (
        <>
          <ContextMenuTrigger ref={triggerRef} onOpen={() => setMenuOpen(true)} isOpen={menuOpen} />
          {menuOpen && (
            <ContextMenu
              items={menuItems}
              isOpen={menuOpen}
              onClose={() => setMenuOpen(false)}
              triggerRef={triggerRef}
            />
          )}
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

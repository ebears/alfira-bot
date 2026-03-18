import type { Playlist, Song } from '@alfira-bot/shared';
import { formatDuration } from '@alfira-bot/shared';
import {
  CircleNotchIcon,
  ListIcon,
  MagnifyingGlassIcon,
  PlayIcon,
  SquaresFourIcon,
} from '@phosphor-icons/react';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { addToPriorityQueue, deleteSong, getPlaylists, getSongs, startPlayback } from '../api/api';
import AddSongModal from '../components/AddSongModal';
import ConfirmModal from '../components/ConfirmModal';
import { ContextMenu, ContextMenuTrigger } from '../components/ContextMenu';
import EmptyState from '../components/EmptyState';
import NotificationToast from '../components/NotificationToast';
import { Button } from '../components/ui/Button';
import { useAdminView } from '../context/AdminViewContext';
import { usePlayer } from '../context/PlayerContext';
import { useNotification } from '../hooks/useNotification';
import { useSocket } from '../hooks/useSocket';
import { useSongActions } from '../hooks/useSongActions';
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
  const handleAddToQueue = async (songId: string) => {
    try {
      await addToPriorityQueue(songId);
      notify('Added to Up Next', 'success');
    } catch (err: unknown) {
      notify(
        apiErrorMessage(err, 'Could not add to queue. Is the bot in a voice channel?'),
        'error',
        5000
      );
    }
  };

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
          <h1 className="font-display text-3xl md:text-4xl text-fg tracking-wider">Library</h1>
          <p className="font-mono text-xs text-muted mt-1">
            {loading ? '—' : `${songs.length} track${songs.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {isAdminView && (
          <Button variant="primary" onClick={() => setShowAddModal(true)}>
            + Add Song
          </Button>
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
          <Button
            variant="foreground"
            size="icon"
            onClick={() => toggleViewMode('grid')}
            className={viewMode === 'grid' ? 'border-accent text-accent bg-accent/10' : ''}
            title="Grid view"
          >
            <SquaresFourIcon size={18} weight="duotone" />
          </Button>
          <Button
            variant="foreground"
            size="icon"
            onClick={() => toggleViewMode('list')}
            className={viewMode === 'list' ? 'border-accent text-accent bg-accent/10' : ''}
            title="List view"
          >
            <ListIcon size={18} weight="duotone" />
          </Button>
        </div>
      </div>

      {/* Song list */}
      {loading ? (
        <SkeletonGrid />
      ) : filtered.length === 0 ? (
        search ? (
          <div className="text-center py-24">
            <p className="font-display text-4xl text-faint tracking-wider mb-2">No Results</p>
            <p className="font-mono text-xs text-faint">no songs match "{search}"</p>
          </div>
        ) : (
          <EmptyState
            title="Empty Library"
            isAdmin={isAdminView}
            onAdd={() => setShowAddModal(true)}
            addLabel="add the first song"
          />
        )
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-3 md:gap-4">
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
              playlists={playlists}
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
  const { menuOpen, setMenuOpen, triggerRef, menuItems } = useSongActions({
    song,
    isAdmin,
    playlists,
    onAddToQueue,
    onDelete,
  });

  return (
    <div
      className="card group animate-fade-up opacity-0 flex flex-col hover:bg-elevated transition-colors duration-150"
      style={style}
    >
      {/* Thumbnail with play overlay */}
      <div className="relative aspect-video bg-elevated overflow-hidden rounded-xl clay-flat m-2 mb-0">
        <img
          src={song.thumbnailUrl}
          alt={song.nickname || song.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />

        {/* Duration badge — bottom right */}
        <span className="absolute bottom-2 right-2 z-20 font-mono text-[10px] text-white/80 bg-black/50 px-1.5 py-0.5 rounded">
          {formatDuration(song.duration)}
        </span>

        {menuOpen && (
          <ContextMenu
            items={menuItems}
            isOpen={menuOpen}
            onClose={() => setMenuOpen(false)}
            triggerRef={triggerRef}
          />
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-body font-semibold text-sm text-fg leading-tight line-clamp-2 min-w-0">
            {song.nickname || song.title}
          </p>
          <div className="flex items-center gap-1 shrink-0 ml-auto">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPlay();
              }}
              disabled={isPlaying}
              className="shrink-0 transition-transform duration-150 disabled:cursor-default cursor-pointer"
              title="Play from this song"
            >
              <Button
                variant="primary"
                size="icon"
              >
                {isPlaying ? (
                  <CircleNotchIcon size={18} weight="bold" className="animate-spin" />
                ) : (
                  <PlayIcon size={18} weight="duotone" />
                )}
              </Button>
            </button>
            <ContextMenuTrigger
              ref={triggerRef}
              onOpen={() => setMenuOpen(true)}
              isOpen={menuOpen}
            />
          </div>
        </div>
        {song.nickname && (
          <p className="text-[11px] text-faint truncate opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {song.title}
          </p>
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
  playlists,
  onDelete,
  onPlay,
  isPlaying,
  onAddToQueue,
}: {
  song: Song;
  isAdmin: boolean;
  playlists: Playlist[];
  onDelete: () => void;
  onPlay: () => void;
  isPlaying: boolean;
  onAddToQueue: () => void;
}) {
  const { menuOpen, setMenuOpen, triggerRef, menuItems } = useSongActions({
    song,
    isAdmin,
    playlists,
    onAddToQueue,
    onDelete,
  });

  return (
    <div className="flex items-center gap-2 md:gap-4 px-3 md:px-4 py-3 rounded-lg group clay-resting hover:clay-raised hover:bg-elevated active:bg-elevated/80 transition-all duration-100">
      <img
        src={song.thumbnailUrl}
        alt={song.nickname || song.title}
        className="w-20 h-12 md:w-16 md:h-10 object-cover rounded border border-border shrink-0"
        loading="lazy"
      />
      <div className="flex-1 min-w-0">
        <p className="font-body text-sm font-medium text-fg truncate">
          {song.nickname || song.title}
        </p>
        {song.nickname && <p className="font-mono text-[10px] text-muted truncate">{song.title}</p>}
      </div>
      <span className="font-mono text-xs text-muted shrink-0">{formatDuration(song.duration)}</span>
      <Button
        variant="foreground"
        size="icon"
        onClick={onPlay}
        disabled={isPlaying}
        className="opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:text-accent active:bg-accent/10 p-2.5 md:p-1 disabled:opacity-50"
        title="Play from this song"
      >
        {isPlaying ? (
          <CircleNotchIcon size={18} weight="bold" className="animate-spin" />
        ) : (
          <PlayIcon size={18} weight="duotone" />
        )}
      </Button>
      <ContextMenuTrigger ref={triggerRef} onOpen={() => setMenuOpen(true)} isOpen={menuOpen} />
      {menuOpen && (
        <ContextMenu
          items={menuItems}
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
          triggerRef={triggerRef}
        />
      )}
    </div>
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

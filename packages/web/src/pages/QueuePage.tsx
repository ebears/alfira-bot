import type { LoopMode, Playlist, QueuedSong } from '@alfira-bot/shared';
import {
  AlertTriangle,
  CirclePlay,
  List,
  Music,
  Play,
  Plus,
  Shuffle,
  Trash2,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  getPlaylists,
  overridePlay,
  quickAddPlaylistToQueue,
  quickAddToQueue,
  startPlayback,
} from '../api/api';
import { Backdrop } from '../components/Backdrop';
import { useAdminView } from '../context/AdminViewContext';
import { usePlayer } from '../context/PlayerContext';
import { apiErrorMessage } from '../utils/api';
import { formatDuration } from '../utils/format';

// ---------------------------------------------------------------------------
// QueuePage
// ---------------------------------------------------------------------------
export default function QueuePage() {
  const { state, loading, elapsed, shuffle, refetch, clear } = usePlayer();
  const { isAdminView } = useAdminView();
  const [showLoadPlaylist, setShowLoadPlaylist] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const [shuffleBusy, setShuffleBusy] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);

  const { currentSong, queue, priorityQueue, isPlaying } = state;
  const progress = currentSong ? Math.min((elapsed / currentSong.duration) * 100, 100) : 0;

  const handleShuffle = async () => {
    setShuffleBusy(true);
    try {
      await shuffle();
    } finally {
      setShuffleBusy(false);
    }
  };

  const handleClear = async () => {
    setClearBusy(true);
    try {
      await clear();
    } finally {
      setClearBusy(false);
    }
  };

  // Loading skeleton
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="skeleton h-8 w-32 mb-8 rounded" />
        <div className="skeleton aspect-video w-full rounded-xl mb-6" />
        <div className="skeleton h-5 w-64 mb-2 rounded" />
        <div className="skeleton h-3 w-32 rounded" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <h1 className="font-display text-4xl md:text-5xl text-fg tracking-wider mb-6 md:mb-8">
        Queue
      </h1>

      {/* ------------------------------------------------------------------ */}
      {/* Admin Override Button */}
      {/* ------------------------------------------------------------------ */}
      {isAdminView && (
        <section className="mb-6">
          <button
            type="button"
            onClick={() => setShowOverride(true)}
            className="flex items-center gap-2 btn-danger"
          >
            <Play size={14} />
            <span>Override</span>
          </button>
          <p className="font-mono text-[10px] text-muted mt-1">
            Immediately play a song, clearing all queues
          </p>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Now Playing card */}
      {/* ------------------------------------------------------------------ */}
      {currentSong ? (
        <NowPlayingCard
          song={currentSong}
          isPlaying={isPlaying}
          elapsed={elapsed}
          progress={progress}
        />
      ) : (
        <IdleCard />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Controls */}
      {/* ------------------------------------------------------------------ */}
      <section className="mt-4 md:mt-6 space-y-3 md:space-y-4">
        {/* Load Playlist / Quick Add */}
        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => setShowLoadPlaylist(true)}
              className="flex items-center gap-2 btn-primary"
            >
              <List size={16} className="md:w-3.5 md:h-3.5" />
              <span className="hidden sm:inline">Load Playlist</span>
              <span className="sm:hidden">Load</span>
            </button>
            <button
              type="button"
              onClick={() => setShowQuickAdd(true)}
              className="flex items-center gap-2 btn-primary"
            >
              <Plus size={16} className="md:w-3.5 md:h-3.5" />
              <span className="hidden sm:inline">Quick Add</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        </div>

        {/* Admin-only controls (Shuffle and Clear Queue) */}
        {isAdminView && (
          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleShuffle}
              disabled={shuffleBusy || queue.length === 0}
              className="flex items-center gap-2 btn-ghost disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Shuffle size={16} className="md:w-3.5 md:h-3.5" />
              <span>Shuffle{queue.length > 0 ? ` (${queue.length})` : ''}</span>
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={
                clearBusy || (queue.length === 0 && priorityQueue.length === 0 && !currentSong)
              }
              className={`flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                queue.length === 0 && priorityQueue.length === 0 && !currentSong
                  ? 'btn-ghost'
                  : 'btn-danger'
              }`}
            >
              <Trash2 size={16} className="md:w-3.5 md:h-3.5" />
              <span>Clear Queue</span>
            </button>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Up Next (Priority Queue) */}
      {/* ------------------------------------------------------------------ */}
      {priorityQueue.length > 0 && (
        <section className="mt-6 md:mt-8">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <h2 className="font-display text-xl md:text-2xl text-fg tracking-wider">
              <Zap size={18} className="inline mr-1" />
              Up Next
              <span className="ml-2 font-mono text-sm text-accent normal-case tracking-normal">
                {priorityQueue.length} {priorityQueue.length === 1 ? 'song' : 'songs'}
              </span>
            </h2>
            <span className="font-mono text-[10px] text-muted uppercase tracking-widest hidden sm:block">
              Priority Queue
            </span>
          </div>
          <div className="space-y-1 border-l-2 border-accent/40 pl-3">
            {priorityQueue.map((song, i) => (
              <div
                key={`priority-${song.id}-${i}`}
                className="flex items-center gap-2 md:gap-4 px-3 md:px-4 py-3 rounded-lg hover:bg-elevated active:bg-elevated/80 transition-colors duration-100 group"
              >
                <span className="font-mono text-xs text-accent w-5 text-right shrink-0">
                  {i + 1}
                </span>
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
                  <p className="font-mono text-[10px] text-muted hidden sm:block">
                    req. {song.requestedBy}
                  </p>
                </div>
                <span className="font-mono text-xs text-muted shrink-0">
                  {formatDuration(song.duration)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Queue */}
      {/* ------------------------------------------------------------------ */}
      <section className="mt-6 md:mt-8">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <h2 className="font-display text-xl md:text-2xl text-fg tracking-wider">
            Queue
            {queue.length > 0 && (
              <span className="ml-2 font-mono text-sm text-muted normal-case tracking-normal">
                {queue.length} {queue.length === 1 ? 'song' : 'songs'}
              </span>
            )}
          </h2>
        </div>
        {queue.length === 0 ? (
          <div className="py-8 md:py-12 text-center border border-dashed border-border rounded-xl">
            <p className="font-mono text-xs text-faint">queue is empty</p>
            {priorityQueue.length === 0 && (
              <button
                type="button"
                onClick={() => setShowLoadPlaylist(true)}
                className="mt-3 font-mono text-xs text-accent hover:underline"
              >
                load a playlist to get started
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {queue.map((song, i) => (
              <div
                key={`${song.id}-${i}`}
                className="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-elevated transition-colors duration-100 group"
              >
                <span className="font-mono text-xs text-faint w-5 text-right shrink-0">
                  {i + 1}
                </span>
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
                  <p className="font-mono text-[10px] text-muted hidden sm:block">
                    req. {song.requestedBy}
                  </p>
                </div>
                <span className="font-mono text-xs text-muted shrink-0">
                  {formatDuration(song.duration)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Load Playlist modal */}
      {/* ------------------------------------------------------------------ */}
      {showLoadPlaylist && (
        <LoadPlaylistModal
          onClose={() => setShowLoadPlaylist(false)}
          onLoaded={async () => {
            setShowLoadPlaylist(false);
            // Give the bot a moment to enqueue before we poll.
            await new Promise((r) => setTimeout(r, 600));
            await refetch();
          }}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Quick Add modal */}
      {/* ------------------------------------------------------------------ */}
      {showQuickAdd && (
        <QuickAddModal
          onClose={() => setShowQuickAdd(false)}
          onAdded={async () => {
            setShowQuickAdd(false);
            // Give the bot a moment to enqueue before we poll.
            await new Promise((r) => setTimeout(r, 600));
            await refetch();
          }}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Override modal */}
      {/* ------------------------------------------------------------------ */}
      {showOverride && (
        <OverrideModal
          onClose={() => setShowOverride(false)}
          onOverride={async () => {
            setShowOverride(false);
            await new Promise((r) => setTimeout(r, 600));
            await refetch();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Now Playing card - Redesigned
// ---------------------------------------------------------------------------
function NowPlayingCard({
  song,
  isPlaying,
  elapsed,
  progress,
}: {
  song: QueuedSong;
  isPlaying: boolean;
  elapsed: number;
  progress: number;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-col sm:flex-row gap-3 md:gap-4 p-4 md:p-5">
        {/* Large square album art */}
        <div className="relative shrink-0 mx-auto sm:mx-0">
          <img
            src={song.thumbnailUrl}
            alt={song.nickname || song.title}
            className="w-32 h-32 md:w-40 md:h-40 rounded-lg border border-border shadow-lg object-cover"
          />
          {/* Playing indicator */}
          {isPlaying && (
            <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-accent flex items-center justify-center shadow-lg">
              <CirclePlay size={14} className="text-white" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 flex flex-col justify-center">
          {/* Song title as YouTube link */}
          <a
            href={song.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-body font-bold md:text-lg text-fg hover:text-accent active:text-accent-muted transition-colors duration-150 line-clamp-2 text-center sm:text-left"
          >
            {song.nickname || song.title}
          </a>

          {/* Requester */}
          <p className="font-mono text-xs text-muted mt-1">requested by {song.requestedBy}</p>

          {/* Progress bar */}
          <div className="mt-3 md:mt-4">
            <div className="relative h-2 w-full bg-elevated rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-accent rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="font-mono text-xs text-muted">{formatDuration(elapsed)}</span>
              <span className="font-mono text-xs text-muted">{formatDuration(song.duration)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Idle state card
// ---------------------------------------------------------------------------
function IdleCard() {
  return (
    <div className="card flex items-center justify-center py-16 border-dashed">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-elevated border border-border flex items-center justify-center mx-auto mb-4">
          <Music size={24} className="text-faint" />
        </div>
        <p className="font-display text-3xl text-faint tracking-wider mb-1">Nothing Playing</p>
        <p className="font-mono text-xs text-faint">
          use /join in Discord, then load a playlist below
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Load Playlist modal
// ---------------------------------------------------------------------------
function LoadPlaylistModal({ onClose, onLoaded }: { onClose: () => void; onLoaded: () => void }) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [selectedId, setSelectedId] = useState<string | ''>('');
  const [mode, setMode] = useState<'sequential' | 'random'>('sequential');
  const [loop, setLoop] = useState<LoopMode>('off');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch playlists on mount
  const loadPlaylists = useCallback(async () => {
    try {
      const data = await getPlaylists();
      setPlaylists(data);
      if (data.length > 0) setSelectedId(data[0].id);
    } finally {
      setLoadingPlaylists(false);
    }
  }, []);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  const handlePlay = async () => {
    if (!selectedId) return;
    setSubmitting(true);
    setError('');
    try {
      await startPlayback({
        playlistId: selectedId,
        mode,
        loop,
      });
      onLoaded();
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Could not start playback. Is the bot in a voice channel?'));
      setSubmitting(false);
    }
  };

  return (
    <Backdrop onClose={onClose}>
      <div className="bg-surface border border-border rounded-xl p-5 md:p-6 w-full max-w-sm mx-4 shadow-2xl animate-fade-up">
        <h2 className="font-display text-2xl md:text-3xl text-fg tracking-wider mb-1">
          Load Playlist
        </h2>
        <p className="font-mono text-xs text-muted mb-4 md:mb-6">choose a playlist to queue</p>

        {loadingPlaylists ? (
          <div className="space-y-2 mb-6">
            <div className="skeleton h-9 w-full rounded" />
          </div>
        ) : playlists.length === 0 ? (
          <p className="font-mono text-xs text-muted mb-6">
            No playlists found. Create one in the Playlists section first.
          </p>
        ) : (
          <div className="space-y-4 mb-6">
            {/* Playlist selector */}
            <div>
              <p className="font-mono text-xs text-muted mb-2 uppercase tracking-widest">
                Playlist
              </p>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="input font-body"
              >
                {playlists.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.name} {pl._count ? ` (${pl._count.songs} songs)` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Order */}
            <div>
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

            {/* Loop */}
            <div>
              <p className="font-mono text-xs text-muted mb-2 uppercase tracking-widest">Loop</p>
              <div className="flex gap-2">
                {(['off', 'song', 'queue'] as const).map((l) => (
                  <button
                    type="button"
                    key={l}
                    onClick={() => setLoop(l)}
                    className={`flex-1 py-2 text-xs font-mono rounded border transition-colors duration-150 ${
                      loop === l
                        ? 'bg-accent/10 border-accent/40 text-accent'
                        : 'border-border text-muted hover:border-muted'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {error && <p className="font-mono text-xs text-danger mb-4">{error}</p>}

        <div className="flex gap-2 justify-end">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handlePlay}
            disabled={submitting || !selectedId || loadingPlaylists}
          >
            {submitting ? (
              'Starting...'
            ) : (
              <>
                {' '}
                <CirclePlay size={12} className="inline mr-1" /> Play{' '}
              </>
            )}
          </button>
        </div>
      </div>
    </Backdrop>
  );
}

// ---------------------------------------------------------------------------
// Quick Add Modal
// ---------------------------------------------------------------------------
function QuickAddModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isPlaylist, setIsPlaylist] = useState(false);
  const [importFullPlaylist, setImportFullPlaylist] = useState(false);

  // Detect playlist URLs
  useEffect(() => {
    const hasListParam = youtubeUrl.includes('list=');
    setIsPlaylist(hasListParam);
    if (!hasListParam) {
      setImportFullPlaylist(false);
    }
  }, [youtubeUrl]);

  const handleSubmit = async () => {
    if (!youtubeUrl.trim()) return;
    setSubmitting(true);
    setError('');
    setSuccessMsg('');
    try {
      if (importFullPlaylist) {
        const result = await quickAddPlaylistToQueue(youtubeUrl.trim());
        setSuccessMsg(result.message);
        setTimeout(() => {
          onAdded();
        }, 1500);
      } else {
        await quickAddToQueue(youtubeUrl.trim());
        onAdded();
      }
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Could not add song to queue. Is the bot in a voice channel?'));
      setSubmitting(false);
    }
  };

  return (
    <Backdrop onClose={onClose}>
      <div className="bg-surface border border-border rounded-xl p-5 md:p-6 w-full max-w-sm mx-4 shadow-2xl animate-fade-up">
        <h2 className="font-display text-2xl md:text-3xl text-fg tracking-wider mb-1">Quick Add</h2>
        <p className="font-mono text-xs text-muted mb-4 md:mb-6">
          add a song to Up Next without saving to library
        </p>

        <div className="space-y-4 mb-6">
          <div>
            <p className="font-mono text-xs text-muted mb-2 uppercase tracking-widest">
              YouTube URL
            </p>
            <input
              type="text"
              value={youtubeUrl}
              onChange={(e) => {
                setYoutubeUrl(e.target.value);
                setError('');
                setSuccessMsg('');
              }}
              placeholder="https://youtube.com/watch?v=..."
              className="input font-body w-full"
              disabled={submitting}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && youtubeUrl.trim()) {
                  handleSubmit();
                }
              }}
            />
            {isPlaylist && (
              <label className="flex items-center gap-2 cursor-pointer mt-2">
                <input
                  type="checkbox"
                  checked={importFullPlaylist}
                  onChange={(e) => setImportFullPlaylist(e.target.checked)}
                  disabled={submitting}
                  className="w-4 h-4 rounded border-border bg-surface accent-accent"
                />
                <span className="font-mono text-xs text-fg">Add all songs from playlist</span>
              </label>
            )}
          </div>
        </div>

        {successMsg && <p className="font-mono text-xs text-success mb-4">{successMsg}</p>}
        {error && <p className="font-mono text-xs text-danger mb-4">{error}</p>}

        {submitting && (
          <p className="font-mono text-xs text-muted mb-4 flex items-center gap-2">
            <span className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin inline-block" />
            {importFullPlaylist ? 'Adding playlist...' : 'Adding...'}
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSubmit}
            disabled={submitting || !youtubeUrl.trim()}
          >
            {submitting ? 'Adding...' : importFullPlaylist ? 'Add Playlist' : 'Add to Up Next'}
          </button>
        </div>
      </div>
    </Backdrop>
  );
}

// ---------------------------------------------------------------------------
// Override Modal (Admin only)
// ---------------------------------------------------------------------------
function OverrideModal({ onClose, onOverride }: { onClose: () => void; onOverride: () => void }) {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!youtubeUrl.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await overridePlay(youtubeUrl.trim());
      onOverride();
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Could not override playback. Is the bot in a voice channel?'));
      setSubmitting(false);
    }
  };

  return (
    <Backdrop onClose={onClose}>
      <div className="bg-surface border border-border rounded-xl p-5 md:p-6 w-full max-w-sm mx-4 shadow-2xl animate-fade-up">
        <h2 className="font-display text-2xl md:text-3xl text-fg tracking-wider mb-1">Override</h2>
        <p className="font-mono text-xs text-danger mb-4 md:mb-6">
          <AlertTriangle size={14} className="inline mr-1" /> This will stop current playback, clear
          all queues, and play the requested song immediately.
        </p>

        <div className="space-y-4 mb-6">
          <div>
            <p className="font-mono text-xs text-muted mb-2 uppercase tracking-widest">
              YouTube URL
            </p>
            <input
              type="text"
              value={youtubeUrl}
              onChange={(e) => {
                setYoutubeUrl(e.target.value);
                setError('');
              }}
              placeholder="https://youtube.com/watch?v=..."
              className="input font-body w-full"
              disabled={submitting}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && youtubeUrl.trim()) {
                  handleSubmit();
                }
              }}
            />
          </div>
        </div>

        {error && <p className="font-mono text-xs text-danger mb-4">{error}</p>}

        {submitting && (
          <p className="font-mono text-xs text-muted mb-4 flex items-center gap-2">
            <span className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin inline-block" />
            Overriding...
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={handleSubmit}
            disabled={submitting || !youtubeUrl.trim()}
          >
            {submitting ? 'Overriding...' : 'Override & Play'}
          </button>
        </div>
      </div>
    </Backdrop>
  );
}

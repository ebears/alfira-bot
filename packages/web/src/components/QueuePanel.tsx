import type { LoopMode, Playlist, QueuedSong } from '@alfira-bot/shared';
import { formatDuration } from '@alfira-bot/shared';
import {
  BombIcon,
  GuitarIcon,
  LightningIcon,
  ListIcon,
  PlayCircleIcon,
  PlayIcon,
  PlusCircleIcon,
  ShuffleIcon,
  WarningIcon,
  XIcon,
} from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { usePlaylistUrlDetection } from '../hooks/usePlaylistUrlDetection';
import { apiErrorMessage } from '../utils/api';

export default function QueuePanel({ onClose }: { onClose: () => void }) {
  const { state, loading, elapsed, shuffle, refetch, clear } = usePlayer();
  const { isAdminView } = useAdminView();
  const [showLoadPlaylist, setShowLoadPlaylist] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const [shuffleBusy, setShuffleBusy] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);

  const { currentSong, queue, priorityQueue, isPlaying } = state;
  const progress = currentSong ? Math.min((elapsed / currentSong.duration) * 100, 100) : 0;
  const isQueueEmpty = queue.length === 0 && priorityQueue.length === 0 && !currentSong;

  const delayThenRefetch = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 600));
    await refetch();
  }, [refetch]);

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

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <PanelHeader onClose={onClose} />
        <div className="flex-1 p-4 space-y-3">
          <div className="skeleton h-5 w-48 rounded" />
          <div className="skeleton h-12 w-full rounded" />
          <div className="skeleton h-12 w-full rounded" />
          <div className="skeleton h-12 w-full rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PanelHeader onClose={onClose} />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Admin Override Button */}
        {isAdminView && (
          <section>
            <button
              type="button"
              onClick={() => setShowOverride(true)}
              className="flex items-center gap-2 btn-danger"
            >
              <PlayIcon size={14} weight="duotone" />
              <span>Override</span>
            </button>
            <p className="font-mono text-[10px] text-muted mt-1">
              Immediately play a song, clearing all queues
            </p>
          </section>
        )}

        {/* Now Playing card */}
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

        {/* Controls */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => setShowLoadPlaylist(true)}
                className="flex items-center gap-2 btn-primary"
              >
                <ListIcon size={16} weight="duotone" />
                <span>Load Playlist</span>
              </button>
              <button
                type="button"
                onClick={() => setShowQuickAdd(true)}
                className="flex items-center gap-2 btn-primary"
              >
                <PlusCircleIcon size={16} weight="duotone" />
                <span>Quick Add</span>
              </button>
            </div>
          </div>

          {isAdminView && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleShuffle}
                disabled={shuffleBusy || queue.length === 0}
                className="flex items-center gap-2 btn-ghost disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ShuffleIcon size={16} weight="duotone" />
                <span>Shuffle{queue.length > 0 ? ` (${queue.length})` : ''}</span>
              </button>
              <button
                type="button"
                onClick={handleClear}
                disabled={clearBusy || isQueueEmpty}
                className={`flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                  isQueueEmpty ? 'btn-ghost' : 'btn-danger'
                }`}
              >
                <BombIcon size={16} weight="duotone" />
                <span>Clear Queue</span>
              </button>
            </div>
          )}
        </section>

        {/* Up Next (Priority Queue) */}
        {priorityQueue.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-lg text-fg tracking-wider">
                <LightningIcon size={16} weight="duotone" className="inline mr-1" />
                Up Next
                <span className="ml-2 font-mono text-xs text-accent normal-case tracking-normal">
                  {priorityQueue.length}
                </span>
              </h2>
            </div>
            <div className="space-y-1 border-l-2 border-accent/40 pl-3">
              {priorityQueue.map((song, i) => (
                <div
                  key={`priority-${song.id}-${i}`}
                  className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-elevated transition-colors duration-100"
                >
                  <span className="font-mono text-[10px] text-accent w-4 text-right shrink-0">
                    {i + 1}
                  </span>
                  <img
                    src={song.thumbnailUrl}
                    alt={song.nickname || song.title}
                    className="w-10 h-7 object-cover rounded border border-border shrink-0"
                    loading="lazy"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-xs font-medium text-fg truncate">
                      {song.nickname || song.title}
                    </p>
                    <p className="font-mono text-[9px] text-muted hidden sm:block">
                      req. {song.requestedBy}
                    </p>
                  </div>
                  <span className="font-mono text-[10px] text-muted shrink-0">
                    {formatDuration(song.duration)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Queue */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-display text-lg text-fg tracking-wider">
              Queue
              {queue.length > 0 && (
                <span className="ml-2 font-mono text-xs text-muted normal-case tracking-normal">
                  {queue.length}
                </span>
              )}
            </h2>
          </div>
          {queue.length === 0 ? (
            <div className="py-6 text-center border border-dashed border-border rounded-xl">
              <p className="font-mono text-[11px] text-faint">queue is empty</p>
              {priorityQueue.length === 0 && (
                <button
                  type="button"
                  onClick={() => setShowLoadPlaylist(true)}
                  className="mt-2 font-mono text-[11px] text-accent hover:underline"
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
                  className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-elevated transition-colors duration-100"
                >
                  <span className="font-mono text-[10px] text-faint w-4 text-right shrink-0">
                    {i + 1}
                  </span>
                  <img
                    src={song.thumbnailUrl}
                    alt={song.nickname || song.title}
                    className="w-10 h-7 object-cover rounded border border-border shrink-0"
                    loading="lazy"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-xs font-medium text-fg truncate">
                      {song.nickname || song.title}
                    </p>
                    <p className="font-mono text-[9px] text-muted hidden sm:block">
                      req. {song.requestedBy}
                    </p>
                  </div>
                  <span className="font-mono text-[10px] text-muted shrink-0">
                    {formatDuration(song.duration)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Modals rendered via portal to escape slideout stacking context */}
      {showLoadPlaylist &&
        createPortal(
          <LoadPlaylistModal
            onClose={() => setShowLoadPlaylist(false)}
            onLoaded={async () => {
              setShowLoadPlaylist(false);
              await delayThenRefetch();
            }}
          />,
          document.body
        )}
      {showQuickAdd &&
        createPortal(
          <QuickAddModal
            onClose={() => setShowQuickAdd(false)}
            onAdded={async () => {
              setShowQuickAdd(false);
              await delayThenRefetch();
            }}
          />,
          document.body
        )}
      {showOverride &&
        createPortal(
          <OverrideModal
            onClose={() => setShowOverride(false)}
            onOverride={async () => {
              setShowOverride(false);
              await delayThenRefetch();
            }}
          />,
          document.body
        )}
    </div>
  );
}

function PanelHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
      <h1 className="font-display text-xl text-fg tracking-wider">Queue</h1>
      <button
        type="button"
        onClick={onClose}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-fg hover:bg-elevated transition-colors duration-150"
        title="Close queue"
      >
        <XIcon size={18} weight="bold" />
      </button>
    </div>
  );
}

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
      <div className="flex gap-3 p-3">
        <div className="relative shrink-0">
          <img
            src={song.thumbnailUrl}
            alt={song.nickname || song.title}
            className="w-20 h-20 rounded-xl border border-border shadow-lg object-cover"
          />
          {isPlaying && (
            <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-accent flex items-center justify-center shadow-lg">
              <PlayCircleIcon size={10} weight="duotone" className="text-white" />
            </div>
          )}
        </div>
        <div className="flex-1 flex flex-col justify-center min-w-0">
          <a
            href={song.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-body font-bold text-sm text-fg hover:text-accent transition-colors duration-150 line-clamp-2"
          >
            {song.nickname || song.title}
          </a>
          <p className="font-mono text-[10px] text-muted mt-0.5">requested by {song.requestedBy}</p>
          <div className="mt-2">
            <div className="relative h-1.5 w-full bg-elevated rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-accent rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="font-mono text-[9px] text-muted">{formatDuration(elapsed)}</span>
              <span className="font-mono text-[9px] text-muted">
                {formatDuration(song.duration)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function IdleCard() {
  return (
    <div className="card flex items-center justify-center py-8 border-dashed">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-elevated border border-border flex items-center justify-center mx-auto mb-3">
          <GuitarIcon size={20} weight="duotone" className="text-faint" />
        </div>
        <p className="font-display text-xl text-faint tracking-wider mb-1">Nothing Playing</p>
        <p className="font-mono text-[10px] text-faint">
          use /join in Discord, then load a playlist
        </p>
      </div>
    </div>
  );
}

function LoadPlaylistModal({ onClose, onLoaded }: { onClose: () => void; onLoaded: () => void }) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [selectedId, setSelectedId] = useState<string | ''>('');
  const [mode, setMode] = useState<'sequential' | 'random'>('sequential');
  const [loop, setLoop] = useState<LoopMode>('off');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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
            <div>
              <p className="font-mono text-xs text-muted mb-2 uppercase tracking-widest">
                Playlist
              </p>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="input"
              >
                {playlists.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.name} {pl._count ? ` (${pl._count.songs} songs)` : ''}
                  </option>
                ))}
              </select>
            </div>

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
                <PlayCircleIcon size={12} weight="duotone" className="inline mr-1" /> Play{' '}
              </>
            )}
          </button>
        </div>
      </div>
    </Backdrop>
  );
}

function QuickAddModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const { isPlaylist, importFullPlaylist, setImportFullPlaylist } =
    usePlaylistUrlDetection(youtubeUrl);

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
              className="input w-full"
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
          <WarningIcon size={14} weight="duotone" className="inline mr-1" /> This will stop current
          playback, clear all queues, and play the requested song immediately.
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
              className="input w-full"
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

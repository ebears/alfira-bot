import { useState, useCallback } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { startPlayback, getPlaylists } from '../api/api';
import type { LoopMode, Playlist } from '../api/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// PlayerPage
// ---------------------------------------------------------------------------
export default function PlayerPage() {
  const { state, loading, elapsed, skip, stop, setLoop, shuffle, refetch } = usePlayer();
  const { user } = useAuth();
  const isAdmin = user?.isAdmin ?? false;

  const [showLoadPlaylist, setShowLoadPlaylist] = useState(false);
  const [loopBusy, setLoopBusy] = useState(false);
  const [shuffleBusy, setShuffleBusy] = useState(false);
  const [skipBusy, setSkipBusy] = useState(false);
  const [stopBusy, setStopBusy] = useState(false);

  const { currentSong, queue, isPlaying, loopMode } = state;

  const progress = currentSong
    ? Math.min((elapsed / currentSong.duration) * 100, 100)
    : 0;

  const handleSkip = async () => {
    setSkipBusy(true);
    try { await skip(); } finally { setSkipBusy(false); }
  };

  const handleStop = async () => {
    setStopBusy(true);
    try { await stop(); } finally { setStopBusy(false); }
  };

  const handleLoop = async (mode: LoopMode) => {
    if (mode === loopMode) return;
    setLoopBusy(true);
    try { await setLoop(mode); } finally { setLoopBusy(false); }
  };

  const handleShuffle = async () => {
    setShuffleBusy(true);
    try { await shuffle(); } finally { setShuffleBusy(false); }
  };

  // ---------------------------------------------------------------------------
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
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="font-display text-5xl text-fg tracking-wider mb-8">Player</h1>

      {/* ------------------------------------------------------------------ */}
      {/* Now Playing card                                                    */}
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
      {/* Admin Controls                                                      */}
      {/* ------------------------------------------------------------------ */}
      {isAdmin && (
        <section className="mt-6 space-y-4">
          {/* Playback controls row */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleSkip}
              disabled={skipBusy || !currentSong}
              className="flex items-center gap-2 btn-ghost disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <IconSkip size={14} />
              <span>Skip</span>
            </button>

            <button
              onClick={handleStop}
              disabled={stopBusy || !currentSong}
              className="flex items-center gap-2 font-body text-sm px-4 py-2 rounded border
                         border-danger/30 text-danger hover:bg-danger/10 transition-colors
                         duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <IconStop size={14} />
              <span>Stop</span>
            </button>

            <button
              onClick={handleShuffle}
              disabled={shuffleBusy || queue.length === 0}
              className="flex items-center gap-2 btn-ghost disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <IconShuffle size={14} />
              <span>Shuffle{queue.length > 0 ? ` (${queue.length})` : ''}</span>
            </button>

            <button
              onClick={() => setShowLoadPlaylist(true)}
              className="flex items-center gap-2 btn-primary ml-auto"
            >
              <IconList size={14} />
              <span>Load Playlist</span>
            </button>
          </div>

          {/* Loop mode selector */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted uppercase tracking-widest mr-1">
              Loop
            </span>
            {(['off', 'song', 'queue'] as const).map((mode) => (
              <button
                key={mode}
                disabled={loopBusy}
                onClick={() => handleLoop(mode)}
                className={`px-3 py-1.5 text-xs font-mono rounded border transition-colors duration-150
                  disabled:opacity-50 ${
                    loopMode === mode
                      ? 'bg-accent/10 border-accent/40 text-accent'
                      : 'border-border text-muted hover:border-muted hover:text-fg'
                  }`}
              >
                {mode === 'off' ? '⬛ off' : mode === 'song' ? '🔂 song' : '🔁 queue'}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Queue                                                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl text-fg tracking-wider">
            Up Next
            {queue.length > 0 && (
              <span className="ml-2 font-mono text-sm text-muted normal-case tracking-normal">
                {queue.length} {queue.length === 1 ? 'song' : 'songs'}
              </span>
            )}
          </h2>
        </div>

        {queue.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-border rounded-xl">
            <p className="font-mono text-xs text-faint">queue is empty</p>
            {isAdmin && (
              <button
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
                className="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-elevated
                           transition-colors duration-100 group"
              >
                <span className="font-mono text-xs text-faint w-5 text-right flex-shrink-0">
                  {i + 1}
                </span>
                <img
                  src={song.thumbnailUrl}
                  alt={song.title}
                  className="w-10 h-7 object-cover rounded border border-border flex-shrink-0"
                  loading="lazy"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm font-medium text-fg truncate">{song.title}</p>
                  <p className="font-mono text-[10px] text-muted">req. {song.requestedBy}</p>
                </div>
                <span className="font-mono text-xs text-muted flex-shrink-0">
                  {formatDuration(song.duration)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Load Playlist modal                                                 */}
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Now Playing card
// ---------------------------------------------------------------------------
function NowPlayingCard({
  song,
  isPlaying,
  elapsed,
  progress,
}: {
  song: { title: string; thumbnailUrl: string; duration: number; requestedBy: string };
  isPlaying: boolean;
  elapsed: number;
  progress: number;
}) {
  return (
    <div className="card overflow-hidden">
      {/* Blurred thumbnail banner */}
      <div className="relative h-48 overflow-hidden">
        <img
          src={song.thumbnailUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-30"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-surface/90" />

        {/* Centred thumbnail */}
        <div className="relative h-full flex items-center justify-center">
          <div className="relative">
            <img
              src={song.thumbnailUrl}
              alt={song.title}
              className="h-36 w-auto rounded-lg border border-border shadow-2xl object-cover"
            />
            {/* Playing indicator */}
            {isPlaying && (
              <div className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-accent
                              flex items-center justify-center shadow-lg">
                <span className="text-base text-[8px]">▶</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info + progress */}
      <div className="px-5 py-4">
        <p className="font-body font-bold text-base text-fg truncate leading-tight">
          {song.title}
        </p>
        <p className="font-mono text-[10px] text-muted mt-0.5">
          requested by {song.requestedBy}
        </p>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="relative h-1 w-full bg-elevated rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-accent rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="font-mono text-[10px] text-muted">{formatDuration(elapsed)}</span>
            <span className="font-mono text-[10px] text-muted">{formatDuration(song.duration)}</span>
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
        <div className="w-16 h-16 rounded-full bg-elevated border border-border flex items-center
                        justify-center mx-auto mb-4">
          <IconMusic size={24} className="text-faint" />
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
function LoadPlaylistModal({
  onClose,
  onLoaded,
}: {
  onClose: () => void;
  onLoaded: () => void;
}) {
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

  useState(() => { loadPlaylists(); });

  const handlePlay = async () => {
    if (!selectedId) return;
    setSubmitting(true);
    setError('');
    try {
      await startPlayback({ playlistId: selectedId, mode, loop });
      onLoaded();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(
        e?.response?.data?.error ??
          'Could not start playback. Is the bot in a voice channel?'
      );
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl animate-fade-up">
        <h2 className="font-display text-3xl text-fg tracking-wider mb-1">Load Playlist</h2>
        <p className="font-mono text-xs text-muted mb-6">choose a playlist to queue</p>

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
                    {pl.name}
                    {pl._count ? ` (${pl._count.songs} songs)` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Order */}
            <div>
              <p className="font-mono text-xs text-muted mb-2 uppercase tracking-widest">
                Order
              </p>
              <div className="flex gap-2">
                {(['sequential', 'random'] as const).map((m) => (
                  <button
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
              <p className="font-mono text-xs text-muted mb-2 uppercase tracking-widest">
                Loop
              </p>
              <div className="flex gap-2">
                {(['off', 'song', 'queue'] as const).map((l) => (
                  <button
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
          <button className="btn-ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handlePlay}
            disabled={submitting || !selectedId || loadingPlaylists}
          >
            {submitting ? 'Starting...' : '▶ Play'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
function IconMusic({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function IconSkip({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="5 4 15 12 5 20 5 4" />
      <line x1="19" y1="5" x2="19" y2="19" />
    </svg>
  );
}

function IconStop({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    </svg>
  );
}

function IconShuffle({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
      <line x1="4" y1="4" x2="9" y2="9" />
    </svg>
  );
}

function IconList({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

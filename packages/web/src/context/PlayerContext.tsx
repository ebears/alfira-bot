import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { getQueueState, skipTrack, stopPlayback, setLoopMode, shuffleQueue } from '../api/api';
import type { QueueState, LoopMode } from '../api/types';

// ---------------------------------------------------------------------------
// Default empty state — used before the first fetch completes.
// ---------------------------------------------------------------------------
const EMPTY_STATE: QueueState = {
  isPlaying: false,
  loopMode: 'off',
  currentSong: null,
  queue: [],
};

interface PlayerContextValue {
  state: QueueState;
  loading: boolean;
  // Elapsed seconds for the current song (client-side simulation).
  elapsed: number;
  // Actions — each calls the API and immediately refetches state.
  skip: () => Promise<void>;
  stop: () => Promise<void>;
  setLoop: (mode: LoopMode) => Promise<void>;
  shuffle: () => Promise<void>;
  // Force an immediate refetch (e.g. after starting playback from PlayerPage).
  refetch: () => Promise<void>;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

const POLL_INTERVAL_MS = 3000;

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<QueueState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  // Track the song ID we last started timing so we can reset when it changes.
  const timedSongId = useRef<string | null>(null);
  const elapsedRef = useRef(0);

  // ---------------------------------------------------------------------------
  // Fetch queue state from the API.
  // ---------------------------------------------------------------------------
  const refetch = useCallback(async () => {
    try {
      const data = await getQueueState();
      setState(data);
    } catch {
      // Swallow errors (bot may be offline) — keep showing last known state.
    } finally {
      setLoading(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Poll on mount and every POLL_INTERVAL_MS.
  // Phase 8 will replace this with Socket.io events.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    refetch();
    const id = setInterval(refetch, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refetch]);

  // ---------------------------------------------------------------------------
  // Client-side elapsed-time counter.
  //
  // The API doesn't return a playback position, so we simulate it locally.
  // We reset whenever the current song changes. This gives a best-effort
  // progress bar that resets cleanly on skip/stop/song-end.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const songId = state.currentSong?.id ?? null;

    if (songId !== timedSongId.current) {
      // Song changed — reset the counter.
      timedSongId.current = songId;
      elapsedRef.current = 0;
      setElapsed(0);
    }

    if (!state.isPlaying || !songId) return;

    const id = setInterval(() => {
      elapsedRef.current = Math.min(
        elapsedRef.current + 1,
        state.currentSong?.duration ?? 0
      );
      setElapsed(elapsedRef.current);
    }, 1000);

    return () => clearInterval(id);
  }, [state.isPlaying, state.currentSong]);

  // ---------------------------------------------------------------------------
  // Action helpers — call API then immediately refetch so the UI updates fast.
  // ---------------------------------------------------------------------------
  const skip = useCallback(async () => {
    await skipTrack();
    // Small delay so the bot has time to advance before we poll.
    await new Promise((r) => setTimeout(r, 400));
    await refetch();
  }, [refetch]);

  const stop = useCallback(async () => {
    await stopPlayback();
    await refetch();
  }, [refetch]);

  const setLoop = useCallback(
    async (mode: LoopMode) => {
      await setLoopMode(mode);
      await refetch();
    },
    [refetch]
  );

  const shuffle = useCallback(async () => {
    await shuffleQueue();
    await refetch();
  }, [refetch]);

  return (
    <PlayerContext.Provider
      value={{ state, loading, elapsed, skip, stop, setLoop, shuffle, refetch }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used inside PlayerProvider');
  return ctx;
}

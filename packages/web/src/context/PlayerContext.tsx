import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { getQueueState, skipTrack, leaveVoice, resumePlayback, setLoopMode, shuffleQueue, clearQueue, togglePause } from '../api/api';
import { useSocket } from '../hooks/useSocket';
import type { QueueState, LoopMode } from '../api/types';

// ---------------------------------------------------------------------------
// Default empty state — used before the first fetch completes.
// ---------------------------------------------------------------------------
const EMPTY_STATE: QueueState = {
  isPlaying: false,
  isPaused: false,
  loopMode: 'off',
  currentSong: null,
  queue: [],
  trackStartedAt: null,
};

interface PlayerContextValue {
  state: QueueState;
  loading: boolean;
  // Elapsed seconds for the current song (client-side simulation).
  elapsed: number;
  // Actions — each calls the API; state updates arrive via Socket.io.
  skip: () => Promise<void>;
  /** Stop playback, clear the queue, and disconnect the bot from voice. */
  leave: () => Promise<void>;
  pause: () => Promise<void>;
  clear: () => Promise<void>;
  resume: () => Promise<void>;
  setLoop: (mode: LoopMode) => Promise<void>;
  shuffle: () => Promise<void>;
  // Force an immediate REST refetch (e.g. after starting playback from QueuePage).
  refetch: () => Promise<void>;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<QueueState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  // Track the song ID we last started timing so we can reset when it changes.
  const timedSongId = useRef<string | null>(null);
  const elapsedRef = useRef(0);

  const socket = useSocket();

  // ---------------------------------------------------------------------------
  // REST fetch — used for initial load and after actions where we want the
  // freshest server state immediately (e.g. after startPlayback).
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
  // Socket.io — primary state update mechanism.
  //
  // On connect (and reconnect), always fetch the current state via REST to
  // avoid a stale snapshot for users who open the page mid-song. After that,
  // player:update events keep the state in sync without polling.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Fetch immediately when the context mounts.
    refetch();

    const handlePlayerUpdate = (data: QueueState) => {
      setState(data);
      // Mark loading as false on the first real-time update too, in case
      // the REST fetch hasn't resolved yet.
      setLoading(false);
    };

    const handleReconnect = () => {
      // Re-sync after a dropped connection so we don't show stale state.
      refetch();
    };

    socket.on('player:update', handlePlayerUpdate);
    socket.on('connect', handleReconnect);

    return () => {
      socket.off('player:update', handlePlayerUpdate);
      socket.off('connect', handleReconnect);
    };
  }, [socket, refetch]);

  // ---------------------------------------------------------------------------
  // Client-side elapsed-time counter.
  //
  // The API doesn't return a playback position, so we simulate it locally.
  // We reset whenever the current song changes. This gives a best-effort
  // progress bar that resets cleanly on skip/stop/song-end.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const songId = state.currentSong?.id ?? null;
    const songChanged = songId !== timedSongId.current;

    if (songChanged) {
      timedSongId.current = songId;
      elapsedRef.current = 0;
      setElapsed(0);
    }

    if (!songId) return;

    // Seed elapsed from server timestamp on first mount or song change.
    // This is what fixes the refresh bug — instead of always starting at 0,
    // we calculate how far along the track actually is.
    if (state.trackStartedAt && state.isPlaying && !state.isPaused) {
      const serverElapsed = Math.floor((Date.now() - state.trackStartedAt) / 1000);
      const clamped = Math.min(serverElapsed, state.currentSong?.duration ?? 0);
      elapsedRef.current = clamped;
      setElapsed(clamped);
    }

    if (!state.isPlaying || state.isPaused) return;

    const id = setInterval(() => {
      elapsedRef.current = Math.min(
        elapsedRef.current + 1,
        state.currentSong?.duration ?? 0
      );
      setElapsed(elapsedRef.current);
    }, 1000);

    return () => clearInterval(id);
  }, [state.isPlaying, state.isPaused, state.currentSong, state.trackStartedAt]);

  // ---------------------------------------------------------------------------
  // Action helpers
  //
  // Each action calls the API and then does a short-delay refetch as a
  // safety net. The socket player:update event will usually arrive first
  // (triggered by GuildPlayer on the server), so the refetch is redundant
  // in the happy path — but it guards against any missed events.
  // ---------------------------------------------------------------------------
  const skip = useCallback(async () => {
    await skipTrack();
    // Small delay so the bot has time to advance before we poll.
    await new Promise((r) => setTimeout(r, 400));
    await refetch();
  }, [refetch]);

  const leave = useCallback(async () => {
    await leaveVoice();
    await refetch();
  }, [refetch]);

  const pause = useCallback(async () => {
    await togglePause();
  }, []);

  const setLoop = useCallback(
    async (mode: LoopMode) => {
      await setLoopMode(mode);
      // No refetch needed — setLoopMode triggers a broadcastQueueUpdate
      // in GuildPlayer which arrives via the socket immediately.
    },
    []
  );

  const shuffle = useCallback(async () => {
    await shuffleQueue();
    // Same as above — the socket event arrives before a refetch would.
  }, []);

  const clear = useCallback(async () => {
    await clearQueue();
    await refetch();
  }, [refetch]);

  const resume = useCallback(async () => {
    await resumePlayback();
    await new Promise((r) => setTimeout(r, 400));
    await refetch();
  }, [refetch]);

  return (
    <PlayerContext.Provider
      value={{ state, loading, elapsed, skip, leave, pause, clear, resume, setLoop, shuffle, refetch }}
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

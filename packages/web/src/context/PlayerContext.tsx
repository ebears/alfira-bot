import type { LoopMode, QueueState } from '@alfira-bot/shared';
import {
  clearQueue,
  fetchQueueState,
  leaveVoice,
  setLoopMode,
  shuffleQueue,
  skipTrack,
  togglePause,
  unshuffleQueue,
} from '@alfira-bot/shared/api';
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useElapsedTimer } from '../hooks/useElapsedTimer';
import { disposeSocket, useSocket } from '../hooks/useSocket';

// ---------------------------------------------------------------------------
// Default empty state — used before the first fetch completes.
// ---------------------------------------------------------------------------
const EMPTY_STATE: QueueState = {
  isPlaying: false,
  isPaused: false,
  isConnectedToVoice: false,
  loopMode: 'off',
  isShuffled: false,
  currentSong: null,
  priorityQueue: [],
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
  setLoop: (mode: LoopMode) => Promise<void>;
  shuffle: () => Promise<void>;
  unshuffle: () => Promise<void>;
  // Force an immediate REST refetch (e.g. after starting playback from QueuePage).
  refetch: () => Promise<void>;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<QueueState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const socket = useSocket();

  // Use the extracted elapsed timer hook
  const elapsed = useElapsedTimer(state);

  // ---------------------------------------------------------------------------
  // REST fetch — used for initial load and after actions where we want the
  // freshest server state immediately (e.g. after startPlayback).
  // ---------------------------------------------------------------------------
  const refetch = useCallback(async () => {
    try {
      const data = await fetchQueueState();
      setState(data);
    } catch {
      // Silently retry on next socket connect or manual refetch
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
  // Cleanup — disconnect the socket when the provider unmounts.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      disposeSocket();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Action helpers
  //
  // Each action calls the API. Socket player:update events keep state in sync.
  // ---------------------------------------------------------------------------
  const skip = useCallback(async () => {
    await skipTrack();
  }, []);

  const leave = useCallback(async () => {
    await leaveVoice();
  }, []);

  const pause = useCallback(async () => {
    await togglePause();
  }, []);

  const clear = useCallback(async () => {
    await clearQueue();
  }, []);

  const setLoop = useCallback(async (mode: LoopMode) => {
    await setLoopMode(mode);
  }, []);

  const shuffle = useCallback(async () => {
    await shuffleQueue();
  }, []);

  const unshuffle = useCallback(async () => {
    await unshuffleQueue();
  }, []);

  const value: PlayerContextValue = {
    state,
    loading,
    elapsed,
    skip,
    leave,
    pause,
    clear,
    setLoop,
    shuffle,
    unshuffle,
    refetch,
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}

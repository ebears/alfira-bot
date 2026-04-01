import type { QueueState } from '@alfira-bot/shared';
import { useEffect, useRef, useState } from 'react';

/**
 * Manages client-side elapsed time for the current song.
 *
 * The API doesn't return a playback position, so we simulate it locally.
 * We reset whenever the current song changes. This gives a best-effort
 * progress bar that resets cleanly on skip/stop/song-end.
 */
export function useElapsedTimer(state: QueueState): number {
  const [elapsed, setElapsed] = useState(0);
  // Track the song ID we last started timing so we can reset when it changes.
  const timedSongId = useRef<string | null>(null);
  const elapsedRef = useRef(0);
  // Store duration in a ref to avoid stale closure in the interval.
  const durationRef = useRef(state.currentSong?.duration ?? 0);

  useEffect(() => {
    durationRef.current = state.currentSong?.duration ?? 0;
  }, [state.currentSong?.duration]);

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
      const clamped = Math.min(serverElapsed, durationRef.current);
      elapsedRef.current = clamped;
      setElapsed(clamped);
    }

    if (!state.isPlaying || state.isPaused) return;

    const id = setInterval(() => {
      elapsedRef.current = Math.min(elapsedRef.current + 1, durationRef.current);
      setElapsed(elapsedRef.current);
    }, 1000);

    return () => clearInterval(id);
  }, [state.isPlaying, state.isPaused, state.currentSong?.id, state.trackStartedAt]);

  return elapsed;
}

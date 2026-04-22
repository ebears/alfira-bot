import type { QueueState } from '@alfira-bot/server/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Manages progress bar animation via rAF + elapsed time via 1-sec interval.
 *
 * Progress bars are driven by direct DOM manipulation (style.width set each
 * animation frame) — no React re-renders for the bar animation itself.
 *
 * Elapsed seconds are driven by a lightweight 1-sec interval solely for time
 * text displays that still need React rendering (e.g. "1:23 / 4:56").
 *
 * Pause/resume is handled by tracking accumulated elapsed when pausing,
 * then computing a new effective start time on resume.
 */
export function useProgressBar(
  state: QueueState,
  overrideElapsed: number | undefined,
  setOverrideElapsed: (elapsed: number | undefined) => void
) {
  const [elapsed, setElapsed] = useState(0);
  const progressBars = useRef<Set<HTMLDivElement>>(new Set());
  const rangeInputs = useRef<Set<HTMLInputElement>>(new Set());
  const rafIdRef = useRef(0);
  // biome-ignore lint/suspicious/noExplicitAny: setInterval return type differs across environments
  const intervalIdRef = useRef<any>(0);

  // Accumulated elapsed ms at pause time; 0 on new song
  const accumulatedMsRef = useRef(0);
  // Effective start = Date.now() - accumulatedMs; updated on pause/resume
  const effectiveStartRef = useRef(0);
  // Track previous song ID to detect song change and reset accumulated time.
  const prevSongIdRef = useRef<string | null>(null);

  const registerProgress = useCallback((ref: HTMLDivElement | null) => {
    if (ref) {
      progressBars.current.add(ref);
    }
  }, []);

  // Register a <input type="range"> whose thumb position should track progress.
  // Its value is updated in the rAF loop so the thumb glides smoothly instead
  // of jumping once per second (which happens when driven by React state alone).
  const registerRangeInput = useCallback((ref: HTMLInputElement | null) => {
    if (ref) {
      rangeInputs.current.add(ref);
    }
  }, []);

  const currentSongId = state.currentSong?.id ?? null;
  const currentSongDuration = state.currentSong?.duration ?? 0;
  const isPlaying = !!state.currentSong && state.isPlaying && !state.isPaused;
  const isPaused = state.isPaused;
  const trackStartedAt = state.trackStartedAt;

  useEffect(() => {
    // When overrideElapsed is provided (after a seek), reset effectiveStart
    // so the rAF loop picks up the new position immediately.
    if (overrideElapsed !== undefined) {
      accumulatedMsRef.current = overrideElapsed * 1000;
      effectiveStartRef.current = Date.now() - overrideElapsed * 1000;
    }

    const prevSongId = prevSongIdRef.current;
    const duration = currentSongDuration;
    const hasSong = currentSongId != null;

    // Detect song change — reset accumulated time
    if (hasSong && currentSongId !== prevSongId) {
      accumulatedMsRef.current = 0;
      prevSongIdRef.current = currentSongId;
    } else if (!hasSong) {
      prevSongIdRef.current = null;
    } else if (overrideElapsed !== undefined) {
      // Same song is playing but elapsedFromTrackStarted is far less than
      // overrideElapsed — the song must have been restarted (e.g. play again
      // after a seek). Clear the override so we seed from the fresh
      // trackStartedAt instead.
      const elapsedFromTrackStarted = trackStartedAt ? (Date.now() - trackStartedAt) / 1000 : 0;
      if (elapsedFromTrackStarted < overrideElapsed / 2) {
        accumulatedMsRef.current = 0;
        effectiveStartRef.current = 0;
        setOverrideElapsed(undefined);
      }
    }

    if (!isPlaying) {
      // Cancel all loops
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (intervalIdRef.current) clearInterval(intervalIdRef.current);
      rafIdRef.current = 0;
      intervalIdRef.current = 0;

      // When truly idle (no song), reset everything
      if (!hasSong && !isPaused) {
        accumulatedMsRef.current = 0;
        setElapsed(0);
        for (const ref of progressBars.current) ref.style.width = '0%';
      }

      // When pausing (song exists + paused), capture current elapsed
      if (hasSong && isPaused) {
        accumulatedMsRef.current =
          effectiveStartRef.current > 0 ? Date.now() - effectiveStartRef.current : 0;
        setElapsed(Math.min(Math.round(accumulatedMsRef.current / 1000), duration));
      }

      return;
    }

    // ---- Starting loops ----
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    if (intervalIdRef.current) clearInterval(intervalIdRef.current);

    // Compute effective start
    let effectiveStart: number;
    if (accumulatedMsRef.current > 0) {
      // Resume: continue from where we left off
      effectiveStart = Date.now() - accumulatedMsRef.current;
    } else if (trackStartedAt) {
      // New song — seed from server timestamp
      const seed = Math.max(
        0,
        Math.min(Math.floor((Date.now() - trackStartedAt) / 1000), duration)
      );
      setElapsed(seed);
      effectiveStart = Date.now() - seed * 1000;
    } else {
      // Fallback: start from 0
      setElapsed(0);
      effectiveStart = Date.now();
    }

    effectiveStartRef.current = effectiveStart;

    // rAF loop — directly sets style.width on registered progress bars AND
    // syncs range input values so the thumb glides at rAF speed, not 1-sec intervals.
    const tick = () => {
      const elapsedMs = Date.now() - effectiveStart;
      const pct = Math.min((elapsedMs / (duration * 1000)) * 100, 100);
      if (pct >= 100) return;
      for (const ref of progressBars.current) {
        ref.style.width = `${pct}%`;
      }
      // Update range input values so thumb position is smooth (not 1-sec jumps)
      const sec = elapsedMs / 1000;
      for (const input of rangeInputs.current) {
        input.value = String(sec);
      }
      rafIdRef.current = requestAnimationFrame(tick);
    };
    rafIdRef.current = requestAnimationFrame(tick);

    // 1-sec interval — updates elapsed React state for time text only
    intervalIdRef.current = setInterval(() => {
      const sec = Math.floor((Date.now() - effectiveStart) / 1000);
      setElapsed(Math.min(Math.max(sec, 0), duration));
    }, 1000);

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (intervalIdRef.current) clearInterval(intervalIdRef.current);
      rafIdRef.current = 0;
      intervalIdRef.current = 0;
    };
  }, [
    currentSongId,
    currentSongDuration,
    isPlaying,
    isPaused,
    trackStartedAt,
    overrideElapsed,
    setOverrideElapsed,
  ]);

  return { elapsed, registerProgress, registerRangeInput };
}

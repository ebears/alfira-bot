import type { QueuedSong } from '@alfira-bot/shared';
import { formatDuration, logger } from '@alfira-bot/shared';
import {
  CircleNotchIcon,
  DoorOpenIcon,
  GuitarIcon,
  ListIcon,
  PauseIcon,
  PlayIcon,
  RepeatIcon,
  RepeatOnceIcon,
  ShuffleIcon,
  SkipForwardIcon,
  SparkleIcon,
} from '@phosphor-icons/react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { BarButton } from './BarButton';
import QueuePanel from './QueuePanel';
import { Button } from './ui/Button';

/* ---------------------------------------------------------------------------
 * Memoized sub-components — these bail out of re-rendering when their props
 * haven't changed, which is most of the time during elapsed-ticking.
 * --------------------------------------------------------------------------- */

interface PlaybackControlsProps {
  currentSong: QueuedSong | null;
  isPaused: boolean;
  isStopped: boolean;
  isPlaying: boolean;
  isConnectedToVoice: boolean;
  pauseBusy: boolean;
  skipBusy: boolean;
  onPauseResume: () => void;
  onSkip: () => void;
  onStop: () => void;
}

const PlaybackControls = memo(function PlaybackControls({
  currentSong,
  isPaused,
  isStopped,
  isPlaying,
  isConnectedToVoice,
  pauseBusy,
  skipBusy,
  onPauseResume,
  onSkip,
  onStop,
}: PlaybackControlsProps) {
  return (
    <div className="flex items-center gap-1 md:gap-1.5 shrink-0">
      {currentSong && (
        <>
          <BarButton
            onClick={onPauseResume}
            busy={pauseBusy}
            disabled={pauseBusy || skipBusy}
            title={isPaused || isStopped ? 'Resume' : 'Pause'}
            hoverColor="hover:text-fg"
            pulse={isPlaying && !isPaused}
          >
            {isPaused || isStopped ? (
              <PlayIcon size={20} weight="duotone" className="md:w-4.5 md:h-4.5" />
            ) : (
              <PauseIcon size={20} weight="duotone" className="md:w-4.5 md:h-4.5" />
            )}
          </BarButton>
          <BarButton
            onClick={onSkip}
            busy={skipBusy}
            disabled={pauseBusy || skipBusy}
            title="Skip"
            hoverColor="hover:text-fg"
          >
            <SkipForwardIcon size={20} weight="duotone" className="md:w-4.5 md:h-4.5" />
          </BarButton>
        </>
      )}

      {isConnectedToVoice && (
        <Button
          variant="foreground"
          size="icon"
          onClick={onStop}
          title="Stop playback"
          className="text-muted hover:text-danger"
        >
          <DoorOpenIcon size={20} weight="duotone" className="md:w-4.5 md:h-4.5" />
        </Button>
      )}
    </div>
  );
});

interface LoopShuffleControlsProps {
  currentSong: QueuedSong | null;
  loopMode: 'off' | 'queue' | 'song';
  isShuffled: boolean;
  loopBusy: boolean;
  shuffleBusy: boolean;
  onCycleLoop: () => void;
  onShuffleToggle: () => void;
}

const LoopShuffleControls = memo(function LoopShuffleControls({
  currentSong,
  loopMode,
  isShuffled,
  loopBusy,
  shuffleBusy,
  onCycleLoop,
  onShuffleToggle,
}: LoopShuffleControlsProps) {
  const loopIcon =
    loopMode === 'song' ? (
      <RepeatOnceIcon size={18} weight="duotone" className="md:w-4 md:h-4" />
    ) : (
      <RepeatIcon size={18} weight="duotone" className="md:w-4 md:h-4" />
    );
  const isLoopActive = loopMode !== 'off';

  return (
    <div className="flex items-center gap-1 md:gap-1.5 shrink-0">
      {currentSong && (
        <>
          <Button
            variant="foreground"
            size="icon"
            onClick={onCycleLoop}
            disabled={loopBusy}
            title={`Loop: ${loopMode}`}
            className={`shrink-0 disabled:opacity-50 ${
              isLoopActive ? 'text-accent hover:text-accent-muted' : 'text-muted hover:text-fg'
            }`}
          >
            {loopBusy ? (
              <CircleNotchIcon size={18} weight="bold" className="animate-spin md:w-4 md:h-4" />
            ) : (
              loopIcon
            )}
          </Button>
          <Button
            variant="foreground"
            size="icon"
            onClick={onShuffleToggle}
            disabled={shuffleBusy}
            title={isShuffled ? 'Unshuffle queue' : 'Shuffle queue'}
            className={`shrink-0 disabled:opacity-50 ${
              isShuffled ? 'text-accent hover:text-accent-muted' : 'text-muted hover:text-fg'
            }`}
          >
            {shuffleBusy ? (
              <CircleNotchIcon size={18} weight="bold" className="animate-spin md:w-4 md:h-4" />
            ) : (
              <ShuffleIcon
                size={20}
                weight={isShuffled ? 'fill' : 'duotone'}
                className="md:w-4 md:h-4"
              />
            )}
          </Button>
        </>
      )}
    </div>
  );
});

interface ProgressBarProps {
  currentSong: QueuedSong | null;
  registerProgress: (ref: HTMLDivElement | null) => void;
  variant: 'mobile' | 'desktop';
}

const ProgressBar = memo(function ProgressBar({
  currentSong,
  registerProgress,
  variant,
}: ProgressBarProps) {
  // rAF-driven progress bar — width set directly by DOM, no React state
  if (variant === 'mobile') {
    return (
      <div
        className="md:hidden h-1 w-full clay-inset relative overflow-hidden"
        style={{ boxShadow: 'var(--clay-shadow-flat)' }}
      >
        <div
          ref={currentSong != null ? registerProgress : null}
          className="absolute inset-y-0 left-0 bg-accent"
          style={{ width: '0%' }}
        />
      </div>
    );
  }

  return (
    <div className="hidden md:flex flex-1 items-center px-4">
      <div className="w-full h-2 clay-inset rounded-full relative overflow-hidden">
        <div
          ref={currentSong != null ? registerProgress : null}
          className="absolute inset-y-0 left-0 bg-accent rounded-full"
          style={{ width: '0%' }}
        />
      </div>
    </div>
  );
});

interface SongInfoProps {
  currentSong: QueuedSong | null;
  elapsed: number;
}

const SongInfo = memo(function SongInfo({ currentSong, elapsed }: SongInfoProps) {
  const elapsedStr = useMemo(() => formatDuration(elapsed), [elapsed]);
  const durationStr = useMemo(
    () => (currentSong ? formatDuration(currentSong.duration) : ''),
    [currentSong]
  );

  return (
    <div className="min-w-0 text-right hidden sm:block">
      {currentSong ? (
        <>
          <p className="font-body text-sm font-semibold text-fg truncate leading-tight max-w-48">
            {currentSong.title}
          </p>
          <p className="font-mono text-[11px] md:text-[10px] text-muted leading-tight">
            {elapsedStr} / {durationStr}
          </p>
        </>
      ) : (
        <span className="font-mono text-xs text-faint">nothing playing</span>
      )}
    </div>
  );
});

interface AlbumArtProps {
  currentSong: QueuedSong | null;
  isPlaying: boolean;
  isPaused: boolean;
}

const AlbumArt = memo(function AlbumArt({ currentSong, isPlaying, isPaused }: AlbumArtProps) {
  return (
    <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl clay-inset shrink-0 overflow-hidden relative">
      {currentSong && isPlaying && !isPaused && (
        <div className="absolute -top-1.5 -right-1.5 z-10">
          <SparkleIcon size={12} weight="duotone" className="text-accent animate-pulse-gentle" />
        </div>
      )}
      {currentSong ? (
        <img
          src={currentSong.thumbnailUrl}
          alt={currentSong.title}
          className="w-full h-full object-cover"
          decoding="async"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <GuitarIcon size={18} weight="duotone" className="text-faint" />
        </div>
      )}
    </div>
  );
});

/* ---------------------------------------------------------------------------
 * Parent component — still re-renders on every tick (reads `elapsed`), but
 * memoized children bail out when their props haven't changed.
 * --------------------------------------------------------------------------- */

export function NowPlayingBar() {
  const { state, elapsed, registerProgress, skip, leave, pause, setLoop, shuffle, unshuffle } =
    usePlayer();
  const { currentSong, isPlaying, isPaused, isConnectedToVoice, loopMode, isShuffled } = state;
  const isStopped = !!currentSong && !isPlaying && !isPaused;

  const [pauseBusy, setPauseBusy] = useState(false);
  const [skipBusy, setSkipBusy] = useState(false);
  const [loopBusy, setLoopBusy] = useState(false);
  const [shuffleBusy, setShuffleBusy] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);

  // Escape key handler + body scroll lock
  useEffect(() => {
    if (!queueOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setQueueOpen(false);
    };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [queueOpen]);

  const handlePauseResume = useCallback(async () => {
    setPauseBusy(true);
    try {
      await pause();
    } catch (e) {
      logger.error(e);
    } finally {
      setPauseBusy(false);
    }
  }, [pause]);

  const handleSkip = useCallback(async () => {
    setSkipBusy(true);
    try {
      await skip();
    } catch (e) {
      logger.error(e);
    } finally {
      setSkipBusy(false);
    }
  }, [skip]);

  const handleStop = useCallback(() => {
    leave().catch((e) => logger.error(e));
  }, [leave]);

  const handleCycleLoop = useCallback(async () => {
    setLoopBusy(true);
    const next = loopMode === 'off' ? 'queue' : loopMode === 'queue' ? 'song' : 'off';
    try {
      await setLoop(next);
    } finally {
      setLoopBusy(false);
    }
  }, [loopMode, setLoop]);

  const handleShuffleToggle = useCallback(async () => {
    setShuffleBusy(true);
    try {
      if (isShuffled) {
        await unshuffle();
      } else {
        await shuffle();
      }
    } finally {
      setShuffleBusy(false);
    }
  }, [isShuffled, shuffle, unshuffle]);

  return (
    <div className="shrink-0 bg-elevated fixed bottom-0 left-0 right-0 md:relative md:bottom-auto md:left-auto md:right-auto safe-area-bottom clay-player-edge">
      {/* Mobile: progress bar on top */}
      <ProgressBar currentSong={currentSong} registerProgress={registerProgress} variant="mobile" />

      <div
        className={`h-26 md:h-24 flex flex-row items-center px-3 md:px-5 gap-2 md:gap-3 ${!currentSong ? 'justify-end md:justify-start' : ''}`}
      >
        {/* Playback controls: Play/Pause, Skip, Leave */}
        <PlaybackControls
          currentSong={currentSong}
          isPaused={isPaused}
          isStopped={isStopped}
          isPlaying={isPlaying}
          isConnectedToVoice={isConnectedToVoice}
          pauseBusy={pauseBusy}
          skipBusy={skipBusy}
          onPauseResume={handlePauseResume}
          onSkip={handleSkip}
          onStop={handleStop}
        />

        {/* Divider */}
        {currentSong && <div className="w-px h-8 md:h-10 bg-border shrink-0 mx-0.5 md:mx-1" />}

        {/* Loop + Shuffle */}
        <LoopShuffleControls
          currentSong={currentSong}
          loopMode={loopMode}
          isShuffled={isShuffled}
          loopBusy={loopBusy}
          shuffleBusy={shuffleBusy}
          onCycleLoop={handleCycleLoop}
          onShuffleToggle={handleShuffleToggle}
        />

        {/* Desktop: centered progress bar */}
        <ProgressBar
          currentSong={currentSong}
          registerProgress={registerProgress}
          variant="desktop"
        />

        {/* Mobile spacer - pushes album art and queue button to the right */}
        <div className="flex-1 md:hidden" />

        {/* Metadata info */}
        <SongInfo currentSong={currentSong} elapsed={elapsed} />

        {/* Album art */}
        <AlbumArt currentSong={currentSong} isPlaying={isPlaying} isPaused={isPaused} />

        {/* Queue button */}
        <Button
          variant="foreground"
          size="icon"
          onClick={() => setQueueOpen(true)}
          title="Queue"
          className={`shrink-0 ${
            queueOpen ? 'text-accent hover:text-accent-muted' : 'text-muted hover:text-fg'
          }`}
        >
          <ListIcon size={20} weight={queueOpen ? 'fill' : 'duotone'} className="md:w-4 md:h-4" />
        </Button>
      </div>

      {/* Queue slideout */}
      {queueOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm cursor-pointer"
            onClick={() => setQueueOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setQueueOpen(false);
            }}
            role="presentation"
          />

          {/* Desktop: right panel */}
          <div className="hidden md:flex fixed z-60 right-0 top-0 bottom-0 w-96 bg-surface animate-slide-in-right flex-col clay-floating">
            <QueuePanel onClose={() => setQueueOpen(false)} />
          </div>

          {/* Mobile: bottom sheet */}
          <div className="md:hidden fixed z-60 bottom-0 left-0 right-0 max-h-[85vh] bg-surface rounded-t-2xl animate-slide-up flex flex-col clay-floating">
            <QueuePanel onClose={() => setQueueOpen(false)} />
          </div>
        </>
      )}
    </div>
  );
}

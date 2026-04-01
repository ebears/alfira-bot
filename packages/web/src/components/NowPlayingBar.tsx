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
import { useCallback, useEffect, useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { BarButton } from './BarButton';
import QueuePanel from './QueuePanel';
import { Button } from './ui/Button';

export function NowPlayingBar() {
  const { state, elapsed, skip, leave, pause, setLoop, shuffle, unshuffle } = usePlayer();
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

  const progress =
    currentSong && currentSong.duration > 0
      ? Math.min((elapsed / currentSong.duration) * 100, 100)
      : 0;

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
    if (loopBusy) return;
    const next = loopMode === 'off' ? 'queue' : loopMode === 'queue' ? 'song' : 'off';
    setLoopBusy(true);
    try {
      await setLoop(next);
    } finally {
      setLoopBusy(false);
    }
  }, [loopMode, loopBusy, setLoop]);

  const handleShuffleToggle = useCallback(async () => {
    if (shuffleBusy) return;
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
  }, [isShuffled, shuffleBusy, shuffle, unshuffle]);

  const loopIcon =
    loopMode === 'song' ? (
      <RepeatOnceIcon size={18} weight="duotone" className="md:w-4 md:h-4" />
    ) : (
      <RepeatIcon size={18} weight="duotone" className="md:w-4 md:h-4" />
    );

  const isLoopActive = loopMode !== 'off';

  return (
    <div className="shrink-0 bg-elevated fixed bottom-0 left-0 right-0 md:relative md:bottom-auto md:left-auto md:right-auto safe-area-bottom clay-player-edge">
      {/* Mobile: progress bar on top */}
      <div
        className="md:hidden h-1 w-full clay-inset relative overflow-hidden"
        style={{ boxShadow: 'var(--clay-shadow-flat)' }}
      >
        <div
          className="absolute inset-y-0 left-0 bg-accent transition-all duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div
        className={`h-26 md:h-24 flex flex-row items-center px-3 md:px-5 gap-2 md:gap-3 ${!currentSong ? 'justify-end md:justify-start' : ''}`}
      >
        {/* Playback controls: Play/Pause, Skip, Leave */}
        <div className="flex items-center gap-1 md:gap-1.5 shrink-0">
          {currentSong && (
            <>
              <BarButton
                onClick={handlePauseResume}
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
                onClick={handleSkip}
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
              onClick={handleStop}
              title="Stop playback"
              className="text-muted hover:text-danger"
            >
              <DoorOpenIcon size={20} weight="duotone" className="md:w-4.5 md:h-4.5" />
            </Button>
          )}
        </div>

        {/* Divider */}
        {currentSong && <div className="w-px h-8 md:h-10 bg-border shrink-0 mx-0.5 md:mx-1" />}

        {/* Loop + Shuffle */}
        <div className="flex items-center gap-1 md:gap-1.5 shrink-0">
          {currentSong && (
            <Button
              variant="foreground"
              size="icon"
              onClick={handleCycleLoop}
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
          )}

          {currentSong && (
            <Button
              variant="foreground"
              size="icon"
              onClick={handleShuffleToggle}
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
          )}
        </div>

        {/* Desktop: centered progress bar */}
        <div className="hidden md:flex flex-1 items-center px-4">
          <div className="w-full h-2 clay-inset rounded-full relative overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-accent rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Mobile spacer - pushes album art and queue button to the right */}
        <div className="flex-1 md:hidden" />

        {/* Metadata info */}
        <div className="min-w-0 text-right hidden sm:block">
          {currentSong ? (
            <>
              <p className="font-body text-sm font-semibold text-fg truncate leading-tight max-w-48">
                {currentSong.title}
              </p>
              <p className="font-mono text-[11px] md:text-[10px] text-muted leading-tight">
                {formatDuration(elapsed)} / {formatDuration(currentSong.duration)}
              </p>
            </>
          ) : (
            <span className="font-mono text-xs text-faint">nothing playing</span>
          )}
        </div>

        {/* Album art */}
        <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl clay-inset shrink-0 overflow-hidden relative">
          {currentSong && isPlaying && !isPaused && (
            <div className="absolute -top-1.5 -right-1.5 z-10">
              <SparkleIcon
                size={12}
                weight="duotone"
                className="text-accent animate-pulse-gentle"
              />
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

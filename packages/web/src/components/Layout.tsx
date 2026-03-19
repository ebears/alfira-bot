import { formatDuration } from '@alfira-bot/shared';
import {
  CaretLeftIcon,
  CircleNotchIcon,
  CraneTowerIcon,
  DoorOpenIcon,
  GuitarIcon,
  ListIcon,
  PauseIcon,
  PlayIcon,
  RepeatIcon,
  RepeatOnceIcon,
  ShuffleIcon,
  SignOutIcon,
  SkipForwardIcon,
  SparkleIcon,
} from '@phosphor-icons/react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { NAV_ITEMS } from '../constants';
import { useAdminView } from '../context/AdminViewContext';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import { useConnectionStatus } from '../hooks/useSocket';
import MobileNav from './MobileNav';
import QueuePanel from './QueuePanel';
import SettingsMenu from './SettingsMenu';
import { Button } from './ui/Button';

export default function Layout() {
  const { user, logout } = useAuth();
  const { isAdminView } = useAdminView();
  const connectionStatus = useConnectionStatus();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex h-full bg-base">
      {/* ------------------------------------------------------------------ */}
      {/* Mobile Navigation - visible on small screens */}
      {/* ------------------------------------------------------------------ */}
      <MobileNav />

      {/* ------------------------------------------------------------------ */}
      {/* Sidebar - visible on medium screens and up */}
      {/* ------------------------------------------------------------------ */}
      <aside
        className={`hidden md:flex ${
          collapsed ? 'w-16' : 'w-56'
        } shrink-0 flex-col bg-elevated transition-[width] duration-200 overflow-hidden clay-sidebar-edge`}
      >
        {/* Wordmark + collapse toggle */}
        <div
          className={`flex pt-6 pb-4 ${
            collapsed
              ? 'flex-col items-center justify-start px-3 gap-2'
              : 'items-center justify-between px-5'
          }`}
        >
          {!collapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-display text-3xl text-accent tracking-wider">Alfira</span>
              {isAdminView && (
                <span className="text-[10px] font-mono bg-accent/10 text-accent border border-accent/20 px-1.5 py-0.5 rounded uppercase tracking-widest">
                  admin
                </span>
              )}
            </div>
          )}
          {collapsed && (
            <div
              className={`w-7 h-7 flex items-center justify-center ${
                isAdminView ? 'text-accent' : 'text-member'
              }`}
              title={isAdminView ? 'Admin mode' : 'Member mode'}
            >
              {isAdminView ? (
                <CraneTowerIcon size={18} weight="duotone" />
              ) : (
                <GuitarIcon size={18} weight="duotone" />
              )}
            </div>
          )}
          <Button
            variant="foreground"
            size="icon"
            className="!w-7 !h-7 shrink-0"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <CaretLeftIcon size={16} weight="duotone" className={collapsed ? 'rotate-180' : ''} />
          </Button>
        </div>

        {/* Nav */}
        <nav className={`flex-1 ${collapsed ? 'px-2' : 'px-3'} space-y-0.5`}>
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center rounded-xl text-sm font-body font-medium transition-all duration-150 ${
                  collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
                } ${isActive ? 'btn-nav-active pressed' : 'btn-nav-inactive'}`
              }
            >
              <Icon size={16} weight="duotone" />
              {!collapsed && label}
            </NavLink>
          ))}
        </nav>

        {/* Settings Menu */}
        <SettingsMenu collapsed={collapsed} />

        {/* Connection status */}
        {connectionStatus !== 'connected' && (
          <div className="px-3 pb-2">
            <div
              className={`flex items-center gap-2 text-xs font-mono px-2 py-1.5 rounded-lg ${
                connectionStatus === 'reconnecting'
                  ? 'bg-warning/10 text-warning'
                  : 'bg-danger/10 text-danger'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  connectionStatus === 'reconnecting' ? 'bg-warning animate-pulse' : 'bg-danger'
                }`}
              />
              {collapsed
                ? ''
                : connectionStatus === 'reconnecting'
                  ? 'Reconnecting...'
                  : 'Disconnected'}
            </div>
          </div>
        )}

        {/* User section */}
        <div className="p-3">
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-7 h-7 rounded-full bg-elevated flex items-center justify-center overflow-hidden"
                title={user?.username}
              >
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-mono text-xs text-muted">
                    {user?.username?.[0]?.toUpperCase()}
                  </span>
                )}
              </div>
              <Button
                variant="danger"
                size="icon"
                className="!w-7 !h-7"
                onClick={handleLogout}
                title="Log out"
              >
                <SignOutIcon size={14} weight="duotone" />
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-2 py-2 mb-1">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.username}
                    className="w-7 h-7 rounded-full"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-elevated flex items-center justify-center">
                    <span className="font-mono text-xs text-muted">
                      {user?.username?.[0]?.toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="text-sm font-body text-fg truncate flex-1">{user?.username}</span>
              </div>
              <Button variant="danger" onClick={handleLogout} className="w-full text-left text-xs">
                log out
              </Button>
            </>
          )}
        </div>
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* Main content + now playing bar */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0">
        <main className="flex-1 overflow-y-auto pb-28 md:pb-0">
          <Outlet />
        </main>
        <NowPlayingBar />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Now Playing bar — wired to PlayerContext
// ---------------------------------------------------------------------------
function NowPlayingBar() {
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

  const progress = currentSong ? Math.min((elapsed / currentSong.duration) * 100, 100) : 0;

  const handlePauseResume = async () => {
    setPauseBusy(true);
    try {
      await pause();
    } catch (e) {
      console.error(e);
    } finally {
      setPauseBusy(false);
    }
  };

  const handleSkip = async () => {
    setSkipBusy(true);
    try {
      await skip();
    } catch (e) {
      console.error(e);
    } finally {
      setSkipBusy(false);
    }
  };

  const handleStop = () => {
    leave().catch(console.error);
  };

  const handleCycleLoop = async () => {
    if (loopBusy) return;
    const next = loopMode === 'off' ? 'queue' : loopMode === 'queue' ? 'song' : 'off';
    setLoopBusy(true);
    try {
      await setLoop(next);
    } finally {
      setLoopBusy(false);
    }
  };

  const handleShuffleToggle = async () => {
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
  };

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

      <div className="h-26 md:h-24 flex flex-row-reverse md:flex-row items-center px-3 md:px-5 gap-2 md:gap-3">
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
              style={
                isLoopActive
                  ? { boxShadow: '0 0 10px 1px var(--color-accent, currentColor)', opacity: 0.85 }
                  : undefined
              }
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
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <GuitarIcon size={18} weight="duotone" className="text-faint" />
            </div>
          )}
        </div>
      </div>

      {/* Queue slideout */}
      {queueOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm cursor-pointer"
            onClick={() => setQueueOpen(false)}
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

// ---------------------------------------------------------------------------
// BarButton
// ---------------------------------------------------------------------------
function BarButton({
  children,
  onClick,
  busy,
  disabled,
  title,
  hoverColor,
  pulse = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
  title: string;
  hoverColor: string;
  pulse?: boolean;
}) {
  return (
    <Button
      variant="foreground"
      size="icon"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${
        busy
          ? 'text-muted'
          : `${pulse ? 'text-accent animate-pulse-gentle' : 'text-muted'} ${hoverColor} cursor-pointer`
      } disabled:pointer-events-none`}
    >
      {busy ? (
        <CircleNotchIcon size={18} weight="bold" className="animate-spin md:w-3.5 md:h-3.5" />
      ) : (
        children
      )}
    </Button>
  );
}

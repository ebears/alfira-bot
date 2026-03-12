import {
  ChevronLeft,
  CirclePause,
  CirclePlay,
  Disc3,
  ListMusic,
  Loader2,
  LogOut,
  Music,
  Pause,
  Play,
  ShieldUser,
  SkipForward,
  SquarePlay,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAdminView } from '../context/AdminViewContext';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import MobileNav from './MobileNav';
import SettingsMenu from './SettingsMenu';

const NAV_ITEMS = [
  { to: '/songs', label: 'Songs', icon: Disc3 },
  { to: '/playlists', label: 'Playlists', icon: ListMusic },
  { to: '/queue', label: 'Queue', icon: SquarePlay },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { isAdminView } = useAdminView();
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
        } shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 overflow-hidden border-t-2 ${
          isAdminView ? 'border-t-accent' : 'border-t-member'
        }`}
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
              {isAdminView ? <ShieldUser size={18} /> : <Music size={18} />}
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="w-7 h-7 shrink-0 flex items-center justify-center rounded text-muted hover:text-fg hover:bg-elevated transition-colors duration-150"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronLeft size={16} className={collapsed ? 'rotate-180' : ''} />
          </button>
        </div>

        {/* Nav */}
        <nav className={`flex-1 ${collapsed ? 'px-2' : 'px-3'} space-y-0.5`}>
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center rounded text-sm font-body font-medium transition-colors duration-150 ${
                  collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
                } ${
                  isActive
                    ? 'bg-accent/20 text-accent border border-accent/30'
                    : 'text-muted hover:text-fg hover:bg-elevated border border-transparent'
                }`
              }
            >
              <Icon size={16} />
              {!collapsed && label}
            </NavLink>
          ))}
        </nav>

        {/* Settings Menu */}
        <SettingsMenu collapsed={collapsed} />

        {/* User section */}
        <div className="p-3 border-t border-border">
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-7 h-7 rounded-full bg-elevated border border-border flex items-center justify-center overflow-hidden"
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
              <button
                type="button"
                onClick={handleLogout}
                className="w-7 h-7 flex items-center justify-center rounded text-muted hover:text-danger hover:bg-elevated transition-colors duration-150"
                title="Log out"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-2 py-2 mb-1">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.username}
                    className="w-7 h-7 rounded-full border border-border"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-elevated border border-border flex items-center justify-center">
                    <span className="font-mono text-xs text-muted">
                      {user?.username?.[0]?.toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="text-sm font-body text-fg truncate flex-1">{user?.username}</span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full text-left px-3 py-2 text-xs font-mono text-muted hover:text-fg hover:bg-elevated rounded transition-colors duration-150"
              >
                log out
              </button>
            </>
          )}
        </div>
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* Main content + now playing bar */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0">
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
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
  const { state, elapsed, skip, leave, pause } = usePlayer();
  const { currentSong, isPlaying, isPaused, isConnectedToVoice } = state;
  const isStopped = !!currentSong && !isPlaying && !isPaused;

  const [pauseBusy, setPauseBusy] = useState(false);
  const [skipBusy, setSkipBusy] = useState(false);

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

  const handleLeave = () => {
    leave().catch(console.error);
  };

  return (
    <div className="shrink-0 border-t border-border bg-surface fixed bottom-0 left-0 right-0 md:relative md:bottom-auto md:left-auto md:right-auto safe-area-bottom">
      {/* Progress bar — sits flush at the very top of the bar */}
      <div className="h-1 md:h-px w-full bg-elevated relative overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-accent transition-all duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="h-18 md:h-16 flex items-center px-3 md:px-6 gap-2 md:gap-4">
        {/* Thumbnail + song info */}
        <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
          <div className="w-11 h-11 md:w-9 md:h-9 rounded bg-elevated border border-border shrink-0 overflow-hidden">
            {currentSong ? (
              <img
                src={currentSong.thumbnailUrl}
                alt={currentSong.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Music size={16} className="text-faint md:w-3.5 md:h-3.5" />
              </div>
            )}
          </div>

          <div className="min-w-0">
            {currentSong ? (
              <>
                <p className="font-body text-sm font-semibold text-fg truncate leading-tight">
                  {currentSong.title}
                </p>
                <p className="font-mono text-[11px] md:text-[10px] text-muted leading-tight flex items-center gap-1">
                  <span className="hidden sm:inline">
                    {formatDuration(elapsed)} / {formatDuration(currentSong.duration)}
                  </span>
                  <span className="sm:hidden">{formatDuration(elapsed)}</span>
                  {isPlaying ? (
                    <CirclePlay size={12} className="text-accent" />
                  ) : (
                    <CirclePause size={12} className="text-muted" />
                  )}
                </p>
              </>
            ) : (
              <span className="font-mono text-xs text-faint">nothing playing</span>
            )}
          </div>
        </div>

        {/* Playback controls */}
        <div className="flex items-center gap-1 md:gap-2 shrink-0">
          {currentSong && (
            <>
              <BarButton
                onClick={handlePauseResume}
                busy={pauseBusy}
                disabled={pauseBusy || skipBusy}
                title={isPaused || isStopped ? 'Resume' : 'Pause'}
                hoverColor="hover:text-fg"
              >
                {isPaused || isStopped ? (
                  <Play size={18} className="md:w-4 md:h-4" />
                ) : (
                  <Pause size={18} className="md:w-4 md:h-4" />
                )}
              </BarButton>
              <BarButton
                onClick={handleSkip}
                busy={skipBusy}
                disabled={pauseBusy || skipBusy}
                title="Skip"
                hoverColor="hover:text-fg"
              >
                <SkipForward size={18} className="md:w-4 md:h-4" />
              </BarButton>
            </>
          )}

          {isConnectedToVoice && (
            <button
              type="button"
              onClick={handleLeave}
              title="Leave voice channel"
              className="w-11 h-11 md:w-8 md:h-8 flex items-center justify-center rounded text-muted hover:text-danger hover:bg-elevated transition-colors duration-150"
            >
              <LogOut size={18} className="md:w-4 md:h-4" />
            </button>
          )}
        </div>
      </div>
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
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
  title: string;
  hoverColor: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`w-11 h-11 md:w-8 md:h-8 flex items-center justify-center rounded-lg md:rounded transition-all duration-150 ${
        busy
          ? 'opacity-40 cursor-not-allowed text-muted'
          : `text-muted ${hoverColor} hover:bg-elevated active:bg-elevated/80 cursor-pointer`
      } disabled:pointer-events-none`}
    >
      {busy ? <Loader2 size={18} className="animate-spin md:w-3.5 md:h-3.5" /> : children}
    </button>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

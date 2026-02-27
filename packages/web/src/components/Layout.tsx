import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAdminView } from '../context/AdminViewContext';
import { usePlayer } from '../context/PlayerContext';

const NAV_ITEMS = [
  { to: '/songs',     label: 'Songs',     icon: IconMusic },
  { to: '/playlists', label: 'Playlists', icon: IconList },
  { to: '/player',    label: 'Player',    icon: IconPlay },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { isAdminView, toggleAdminView } = useAdminView();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex h-full bg-base">
      {/* ------------------------------------------------------------------ */}
      {/* Sidebar                                                             */}
      {/* ------------------------------------------------------------------ */}
      <aside
        className={`${
          collapsed ? 'w-16' : 'w-56'
        } flex-shrink-0 flex flex-col border-r border-border bg-surface transition-[width] duration-200 overflow-hidden${
          user?.isAdmin ? ' border-t-2 border-t-accent' : ''
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
              <span className="font-display text-3xl text-accent tracking-wider">alfira</span>
              {user?.isAdmin && (
                <span className="text-[10px] font-mono bg-accent/10 text-accent border border-accent/20 px-1.5 py-0.5 rounded uppercase tracking-widest">
                  admin
                </span>
              )}
            </div>
          )}
          {collapsed && user?.isAdmin && (
            <div
              className="w-7 h-7 flex items-center justify-center text-accent"
              title="Admin mode"
            >
              <IconShield size={18} />
            </div>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded text-muted
                       hover:text-fg hover:bg-elevated transition-colors duration-150"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <IconChevron size={16} pointRight={collapsed} />
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
                    ? 'bg-accent/10 text-accent'
                    : 'text-muted hover:text-fg hover:bg-elevated'
                }`
              }
            >
              <Icon size={16} />
              {!collapsed && label}
            </NavLink>
          ))}
        </nav>

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
                onClick={handleLogout}
                className="w-7 h-7 flex items-center justify-center rounded text-muted
                           hover:text-danger hover:bg-elevated transition-colors duration-150"
                title="Log out"
              >
                <IconLogout size={14} />
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
                <span className="text-sm font-body text-fg truncate flex-1">
                  {user?.username}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="w-full text-left px-3 py-2 text-xs font-mono text-muted hover:text-fg
                           hover:bg-elevated rounded transition-colors duration-150"
              >
                log out
              </button>
            </>
          )}
        </div>
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* Main content + now playing bar                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex-shrink-0 h-11 flex items-center justify-end px-5 border-b border-border/50">
          <button
            onClick={user?.isAdmin ? toggleAdminView : undefined}
            disabled={!user?.isAdmin}
            title={!user?.isAdmin ? 'Admin only' : isAdminView ? 'Switch to user view' : 'Switch to admin view'}
            className={`flex items-center gap-1.5 font-mono text-[11px] px-3 py-1 rounded border
                       transition-colors duration-150 ${
                         !user?.isAdmin
                           ? 'border-border/40 text-faint cursor-not-allowed'
                           : isAdminView
                             ? 'bg-accent/10 border-accent/30 text-accent hover:bg-accent/20'
                             : 'border-border text-muted hover:text-fg hover:border-muted'
                       }`}
          >
            <IconShield size={12} />
            {isAdminView ? 'admin view' : 'user view'}
          </button>
        </div>

        <main className="flex-1 overflow-y-auto">
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
  const { state, elapsed, skip, stop, pause, resume } = usePlayer();
  const { isAdminView } = useAdminView();
  const { currentSong, isPlaying, isPaused } = state;
  const isStopped = !!currentSong && !isPlaying && !isPaused;

  const progress = currentSong
    ? Math.min((elapsed / currentSong.duration) * 100, 100)
    : 0;

  return (
    <div className="flex-shrink-0 border-t border-border bg-surface">
      {/* Progress bar — sits flush at the very top of the bar */}
      <div className="h-px w-full bg-elevated relative overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-accent transition-all duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="h-16 flex items-center px-6 gap-4">
        {/* Thumbnail + song info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded bg-elevated border border-border flex-shrink-0 overflow-hidden">
            {currentSong ? (
              <img
                src={currentSong.thumbnailUrl}
                alt={currentSong.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <IconMusic size={14} className="text-faint" />
              </div>
            )}
          </div>

          <div className="min-w-0">
            {currentSong ? (
              <>
                <p className="font-body text-sm font-semibold text-fg truncate leading-tight">
                  {currentSong.title}
                </p>
                <p className="font-mono text-[10px] text-muted leading-tight">
                  {formatDuration(elapsed)} / {formatDuration(currentSong.duration)}
                  {isPlaying ? (
                    <span className="ml-2 text-accent">▶</span>
                  ) : (
                    <span className="ml-2 text-muted">⏸</span>
                  )}
                </p>
              </>
            ) : (
              <span className="font-mono text-xs text-faint">nothing playing</span>
            )}
          </div>
        </div>

        {/* Admin controls */}
        {isAdminView && currentSong && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => {
                if (isStopped) {
                  resume().catch(console.error);
                } else {
                  pause().catch(console.error);
                }
              }}
              className="w-8 h-8 flex items-center justify-center rounded text-muted
                         hover:text-fg hover:bg-elevated transition-colors duration-150"
              title={isPaused || isStopped ? 'Resume' : 'Pause'}
            >
              {isPaused || isStopped ? <IconPlay size={16} /> : <IconPause size={16} />}
            </button>
            <button
              onClick={() => skip().catch(console.error)}
              className="w-8 h-8 flex items-center justify-center rounded text-muted
                         hover:text-fg hover:bg-elevated transition-colors duration-150"
              title="Skip"
            >
              <IconSkip size={16} />
            </button>
            <button
              onClick={() => stop().catch(console.error)}
              className="w-8 h-8 flex items-center justify-center rounded text-muted
                         hover:text-danger hover:bg-elevated transition-colors duration-150"
              title="Stop"
            >
              <IconStop size={16} />
            </button>

          </div>
        )}
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

function IconPlay({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="5 3 19 12 5 21 5 3" />
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

function IconChevron({ size = 20, pointRight = false, className = '' }: { size?: number; pointRight?: boolean; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {pointRight
        ? <polyline points="9 18 15 12 9 6" />
        : <polyline points="15 18 9 12 15 6" />
      }
    </svg>
  );
}

function IconLogout({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function IconShield({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconPause({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

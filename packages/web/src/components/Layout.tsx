import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/songs',     label: 'Songs',     icon: IconMusic },
  { to: '/playlists', label: 'Playlists', icon: IconList },
  { to: '/player',    label: 'Player',    icon: IconPlay },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex h-full bg-base">
      {/* ------------------------------------------------------------------ */}
      {/* Sidebar                                                             */}
      {/* ------------------------------------------------------------------ */}
      <aside className="w-56 flex-shrink-0 flex flex-col border-r border-border bg-surface">
        {/* Wordmark */}
        <div className="px-5 pt-6 pb-4">
          <span className="font-display text-3xl text-accent tracking-wider">alfira</span>
          {user?.isAdmin && (
            <span className="ml-2 text-[10px] font-mono bg-accent/10 text-accent border border-accent/20 px-1.5 py-0.5 rounded uppercase tracking-widest">
              admin
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded text-sm font-body font-medium transition-colors duration-150 ${
                  isActive
                    ? 'bg-accent/10 text-accent'
                    : 'text-muted hover:text-fg hover:bg-elevated'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-border">
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
        </div>
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* Main content + now playing bar                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

        {/* Now Playing bar — wired up in Phase 8 */}
        <NowPlayingBar />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Now Playing bar stub — Phase 7 will implement the real player state.
// ---------------------------------------------------------------------------
function NowPlayingBar() {
  return (
    <div className="h-16 flex-shrink-0 border-t border-border bg-surface flex items-center px-6 gap-4">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-9 h-9 rounded bg-elevated border border-border flex-shrink-0 flex items-center justify-center">
          <IconMusic size={14} className="text-faint" />
        </div>
        <span className="font-mono text-xs text-faint truncate">nothing playing</span>
      </div>
      <span className="font-mono text-[10px] text-faint/50 uppercase tracking-widest">
        phase 7
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Minimal inline SVG icons
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

import { CaretLeftIcon, CraneTowerIcon, GuitarIcon, SignOutIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { NAV_ITEMS } from '../constants';
import { useAdminView } from '../context/AdminViewContext';
import { useAuth } from '../context/AuthContext';
import { useConnectionStatus } from '../hooks/useSocket';
import MobileNav from './MobileNav';
import { NowPlayingBar } from './NowPlayingBar';
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
        {/* Wordmark */}
        <div
          className={`flex pt-6 pb-4 ${
            collapsed ? 'flex-col items-center justify-start px-3 gap-2' : 'items-center px-5'
          }`}
        >
          {!collapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-display text-5xl text-accent tracking-wider">Alfira</span>
              {isAdminView && (
                <span className="relative top-1 -left-1 flex items-center justify-center w-10 h-10 shrink-0 rounded border border-accent/30 bg-accent/10">
                  <CraneTowerIcon size={24} weight="duotone" className="text-accent" />
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
        </div>

        {/* Nav */}
        <nav className={`flex-1 ${collapsed ? 'px-2' : 'px-3'} space-y-2`}>
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

        {/* Collapse toggle */}
        <div className={collapsed ? 'flex justify-center px-2 pb-2' : 'px-3 pb-2'}>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`flex items-center rounded-xl text-sm font-body font-medium transition-all duration-150 w-full ${
              collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
            } btn-nav-inactive hover:bg-surface/50`}
          >
            <CaretLeftIcon size={16} weight="duotone" className={collapsed ? 'rotate-180' : ''} />
            {!collapsed && 'Collapse'}
          </button>
        </div>

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
                    decoding="async"
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
                className="w-7! h-7!"
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
                    decoding="async"
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

import { CraneTowerIcon, GearIcon, GuitarIcon, ListIcon, XCircleIcon } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '../constants';
import { useAdminView } from '../context/AdminViewContext';
import { useAuth } from '../context/AuthContext';
import SettingsContent from './SettingsContent';

export default function MobileNav() {
  const { user } = useAuth();
  const { isAdminView } = useAdminView();
  const [isOpen, setIsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close drawer on escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close drawer when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <>
      {/* Mobile header bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-4 bg-surface border-b border-border safe-area-top">
        {/* Left: Menu button */}
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-11 h-11 flex items-center justify-center rounded-lg text-muted hover:text-fg hover:bg-elevated transition-colors duration-150"
          aria-label="Open navigation menu"
        >
          <ListIcon size={24} weight="duotone" />
        </button>

        {/* Center: Wordmark */}
        <div className="flex items-center gap-2">
          <span className="font-display text-2xl text-accent tracking-wider">Alfira</span>
          {isAdminView && (
            <span className="text-[9px] font-mono bg-accent/10 text-accent border border-accent/20 px-1.5 py-0.5 rounded uppercase tracking-widest">
              admin
            </span>
          )}
        </div>

        {/* Right: User avatar */}
        <div className="w-11 h-11 flex items-center justify-center">
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={user.username}
              className="w-8 h-8 rounded-full border border-border"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-elevated border border-border flex items-center justify-center">
              <span className="font-mono text-xs text-muted">
                {user?.username?.[0]?.toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Backdrop overlay */}
      {isOpen && (
        <button
          type="button"
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-up"
          onClick={() => setIsOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || e.key === 'Enter') setIsOpen(false);
          }}
        />
      )}

      {/* Slide-out drawer */}
      <div
        ref={drawerRef}
        className={`md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 max-w-[85vw] bg-surface border-r border-border flex flex-col transform transition-transform duration-300 ease-out safe-area-top ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 flex items-center justify-center ${
                isAdminView ? 'text-accent' : 'text-member'
              }`}
            >
              {isAdminView ? (
                <CraneTowerIcon size={20} weight="duotone" />
              ) : (
                <GuitarIcon size={20} weight="duotone" />
              )}
            </div>
            <span className="font-display text-2xl text-accent tracking-wider">Alfira</span>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="w-11 h-11 flex items-center justify-center rounded-lg text-muted hover:text-fg hover:bg-elevated transition-colors duration-150"
            aria-label="Close navigation menu"
          >
            <XCircleIcon size={24} weight="duotone" />
          </button>
        </div>

        {/* Navigation links */}
        <nav className="p-3 space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setIsOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3.5 rounded-xl text-base font-medium transition-colors duration-150 ${
                  isActive
                    ? 'bg-accent/20 text-accent border border-accent/30'
                    : 'text-muted hover:text-fg hover:bg-elevated border border-transparent'
                }`
              }
            >
              <Icon size={20} weight="duotone" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Settings button and User info at bottom */}
        <div className="mt-auto border-t border-border">
          {/* Settings button */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-lg text-[1rem] font-medium text-muted hover:text-fg hover:bg-elevated transition-colors duration-150"
          >
            <GearIcon size={20} weight="duotone" />
            Settings
          </button>

          {/* User info */}
          <div className="p-4 border-t border-border safe-area-bottom">
            <div className="flex items-center gap-3 px-2 py-2">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.username}
                  className="w-10 h-10 rounded-full border border-border"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-elevated border border-border flex items-center justify-center">
                  <span className="font-mono text-sm text-muted">
                    {user?.username?.[0]?.toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-fg truncate">{user?.username}</p>
                <p className="text-xs text-muted">Logged in</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings panel - full height slide-in from right */}
      {isSettingsOpen && (
        <SettingsPanel
          onClose={() => setIsSettingsOpen(false)}
          onLogout={() => {
            setIsSettingsOpen(false);
            setIsOpen(false);
          }}
        />
      )}
    </>
  );
}

// Settings panel component for mobile
function SettingsPanel({ onClose, onLogout }: { onClose: () => void; onLogout: () => void }) {
  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        className="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Escape' || e.key === 'Enter') onClose();
        }}
      />

      {/* Panel - full height slide in from right */}
      <div className="fixed top-0 right-0 bottom-0 z-70 w-80 max-w-[85vw] bg-surface border-l border-border animate-slide-in-right safe-area-top safe-area-bottom">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-display text-2xl text-fg tracking-wide">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-lg text-muted hover:text-fg hover:bg-elevated transition-colors duration-150"
          >
            <XCircleIcon size={24} weight="duotone" />
          </button>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <SettingsContent />
        </div>

        {/* Logout button at bottom */}
        <div className="p-4 border-t border-border safe-area-bottom">
          <button type="button" onClick={onLogout} className="btn-danger w-full text-center">
            Log out
          </button>
        </div>
      </div>
    </>
  );
}

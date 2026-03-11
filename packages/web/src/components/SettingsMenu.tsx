import { Settings, X } from 'lucide-react';
import { useState } from 'react';
import { useAdminView } from '../context/AdminViewContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import SettingsToggle from './settings/SettingsToggle';

interface SettingsMenuProps {
  collapsed?: boolean;
  onClose?: () => void;
}

export default function SettingsMenu({ collapsed = false, onClose }: SettingsMenuProps) {
  const { user } = useAuth();
  const { isAdminView, toggleAdminView } = useAdminView();
  const { theme, setTheme, themes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Settings button in sidebar */}
      <div className={collapsed ? 'flex justify-center px-2 pb-2' : 'px-3 pb-2'}>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          title={collapsed ? 'Settings' : undefined}
          className={
            collapsed
              ? 'w-7 h-7 flex items-center justify-center rounded text-muted hover:text-fg hover:bg-elevated transition-colors duration-150'
              : 'w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-body font-medium text-muted hover:text-fg hover:bg-elevated transition-colors duration-150'
          }
        >
          <Settings size={16} />
          {!collapsed && <span>Settings</span>}
        </button>
      </div>

      {/* Settings panel overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          {/* Backdrop */}
          <button
            type="button"
            className="absolute inset-0 bg-base/80 backdrop-blur-sm cursor-default"
            onClick={() => setIsOpen(false)}
            aria-label="Close settings"
          />

          {/* Panel */}
          <div className="relative w-full max-w-md bg-surface border border-border rounded-t-lg sm:rounded-lg shadow-2xl animate-fade-up">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-display text-2xl text-fg tracking-wide">Settings</h2>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onClose?.();
                }}
                className="w-11 h-11 flex items-center justify-center rounded-lg text-muted hover:text-fg hover:bg-elevated transition-colors duration-150"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="px-5 py-4 space-y-6">
              {/* Admin Mode Toggle */}
              {user?.isAdmin && (
                <div className="space-y-2">
                  <h3 className="font-mono text-[11px] text-muted uppercase tracking-wider">
                    Admin
                  </h3>
                  <SettingsToggle
                    label="Admin Mode"
                    description="Enable administrative features and controls"
                    checked={isAdminView}
                    onChange={toggleAdminView}
                  />
                </div>
              )}

              {/* Theme Selector */}
              <div className="space-y-2">
                <h3 className="font-mono text-[11px] text-muted uppercase tracking-wider">Theme</h3>
                <div className="space-y-1">
                  {themes.map((t) => (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => setTheme(t.name)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-body transition-colors duration-150 ${
                        theme === t.name
                          ? 'bg-accent/10 text-accent border border-accent/30'
                          : 'text-muted hover:text-fg hover:bg-elevated border border-transparent'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full border ${
                          theme === t.name ? 'border-accent' : 'border-border'
                        }`}
                        style={{
                          backgroundColor:
                            t.name === 'dark'
                              ? '#080808'
                              : t.name === 'light'
                                ? '#f5f5f5'
                                : '#0a0a1a',
                        }}
                      />
                      <span>{t.displayName}</span>
                      {theme === t.name && (
                        <span className="ml-auto font-mono text-[10px] text-accent">active</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import { DesktopIcon, MoonIcon, SunIcon } from '@phosphor-icons/react';
import { useAdminView } from '../context/AdminViewContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import SettingsToggle from './settings/SettingsToggle';

export default function SettingsContent() {
  const { user } = useAuth();
  const { isAdminView, toggleAdminView } = useAdminView();
  const { colorTheme, mode, setColorTheme, setMode, colorThemes } = useTheme();

  return (
    <div className="space-y-6">
      {/* Admin Mode Toggle */}
      {user?.isAdmin && (
        <div className="space-y-2">
          <h3 className="font-mono text-[11px] text-muted uppercase tracking-wider">Admin</h3>
          <SettingsToggle
            label="Admin Mode"
            description="Enable administrative features and controls"
            checked={isAdminView}
            onChange={toggleAdminView}
          />
        </div>
      )}

      {/* Color Theme Selector */}
      <div className="space-y-2">
        <h3 className="font-mono text-[11px] text-muted uppercase tracking-wider">Color Theme</h3>
        <div className="grid grid-cols-2 gap-2">
          {colorThemes.map((t) => (
            <button
              key={t.name}
              type="button"
              onClick={() => setColorTheme(t.name)}
              className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-body transition-colors duration-150 ${
                colorTheme === t.name
                  ? 'bg-accent/10 text-accent border border-accent/30'
                  : 'text-muted hover:text-fg hover:bg-elevated border border-transparent'
              }`}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: t.accentColor }}
              />
              <span className="truncate">{t.displayName}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="space-y-2">
        <h3 className="font-mono text-[11px] text-muted uppercase tracking-wider">Appearance</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('auto')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-body transition-colors duration-150 ${
              mode === 'auto'
                ? 'bg-accent/10 text-accent border border-accent/30'
                : 'bg-elevated text-muted border border-border hover:text-fg'
            }`}
          >
            <DesktopIcon size={16} weight="duotone" />
            <span>Auto</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('light')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-body transition-colors duration-150 ${
              mode === 'light'
                ? 'bg-accent/10 text-accent border border-accent/30'
                : 'bg-elevated text-muted border border-border hover:text-fg'
            }`}
          >
            <SunIcon size={16} weight="duotone" />
            <span>Light</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('dark')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-body transition-colors duration-150 ${
              mode === 'dark'
                ? 'bg-accent/10 text-accent border border-accent/30'
                : 'bg-elevated text-muted border border-border hover:text-fg'
            }`}
          >
            <MoonIcon size={16} weight="duotone" />
            <span>Dark</span>
          </button>
        </div>
        <p className="text-xs text-faint">
          {colorThemes.find((t) => t.name === colorTheme)?.description}
        </p>
      </div>
    </div>
  );
}

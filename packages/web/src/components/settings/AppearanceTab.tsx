import { DesktopIcon, MoonIcon, SunIcon } from '@phosphor-icons/react';
import { useAdminView } from '../../context/AdminViewContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../ui/Button';
import SettingsToggle from './SettingsToggle';

export default function AppearanceTab() {
  const { user } = useAuth();
  const { isAdminView, toggleAdminView } = useAdminView();
  const { colorTheme, mode, setColorTheme, setMode, colorThemes } = useTheme();

  return (
    <div className="space-y-6">
      {user?.isAdmin && (
        <div className="space-y-2">
          <h3 className="font-mono text-[11px] text-muted uppercase tracking-wider">Admin</h3>
          <SettingsToggle
            label="Admin View"
            description="Enable administrative features and controls"
            checked={isAdminView}
            onChange={toggleAdminView}
          />
        </div>
      )}

      {/* Appearance: Auto / Light / Dark */}
      <div className="space-y-2">
        <h3 className="font-mono text-[11px] text-muted uppercase tracking-wider">Appearance</h3>
        <div className="flex gap-2">
          <Button
            variant="inherit"
            surface="base"
            className={`flex-1 flex items-center gap-2 ${mode === 'auto' ? 'pressed' : ''}`}
            onClick={() => setMode('auto')}
          >
            <DesktopIcon size={16} weight="duotone" />
            <span>Auto</span>
          </Button>
          <Button
            variant="inherit"
            surface="base"
            className={`flex-1 flex items-center gap-2 ${mode === 'light' ? 'pressed' : ''}`}
            onClick={() => setMode('light')}
          >
            <SunIcon size={16} weight="duotone" />
            <span>Light</span>
          </Button>
          <Button
            variant="inherit"
            surface="base"
            className={`flex-1 flex items-center gap-2 ${mode === 'dark' ? 'pressed' : ''}`}
            onClick={() => setMode('dark')}
          >
            <MoonIcon size={16} weight="duotone" />
            <span>Dark</span>
          </Button>
        </div>
      </div>

      {/* Color Theme Selector */}
      <div className="space-y-2">
        <h3 className="font-mono text-[11px] text-muted uppercase tracking-wider">Color Theme</h3>
        <div className="flex flex-wrap gap-2">
          {colorThemes.map((t) => {
            const isSelected = colorTheme === t.name;
            return (
              <button
                key={t.name}
                type="button"
                onClick={() => setColorTheme(t.name)}
                className={`flex flex-col items-center gap-1.5 p-1 rounded-lg transition-opacity ${
                  isSelected ? 'opacity-100' : 'opacity-60 hover:opacity-80'
                }`}
              >
                <span
                  className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    isSelected ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground' : ''
                  }`}
                  style={{ backgroundColor: t.accentColor }}
                >
                  {isSelected ? (
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 12 12" aria-hidden="true">
                      <path d="M10.28 2.28L4.5 8.06l-2.78-2.79a.5.5 0 0 0-.71.71l3.15 3.15a.5.5 0 0 0 .71 0l6.36-6.36a.5.5 0 0 0 0-.71.5.5 0 0 0-.71 0z" />
                    </svg>
                  ) : null}
                </span>
                <span className="text-xs text-muted leading-none">{t.displayName}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

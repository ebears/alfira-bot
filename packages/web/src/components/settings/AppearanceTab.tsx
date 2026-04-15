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
            <Button
              key={t.name}
              variant="inherit"
              surface="base"
              className={`flex items-center gap-2 ${colorTheme === t.name ? 'pressed' : ''}`}
              onClick={() => setColorTheme(t.name)}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: t.accentColor }}
              />
              <span className="truncate">{t.displayName}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Mode Toggle */}
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
        <p className="text-xs text-faint">
          {colorThemes.find((t) => t.name === colorTheme)?.description}
        </p>
      </div>
    </div>
  );
}

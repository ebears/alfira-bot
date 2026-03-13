import type React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

// Color themes based on D&D 5e core classes
export type ColorThemeName =
  | 'artificer'
  | 'barbarian'
  | 'bard'
  | 'cleric'
  | 'druid'
  | 'fighter'
  | 'monk'
  | 'paladin'
  | 'ranger'
  | 'rogue'
  | 'sorcerer'
  | 'warlock'
  | 'wizard';

export type ColorMode = 'light' | 'dark' | 'auto';

export interface ColorTheme {
  name: ColorThemeName;
  displayName: string;
  description: string;
  accentColor: string; // Preview color for UI
}

export const COLOR_THEMES: ColorTheme[] = [
  {
    name: 'artificer',
    displayName: 'Artificer',
    description: 'Ingenuity and invention',
    accentColor: '#f97316', // Orange
  },
  {
    name: 'barbarian',
    displayName: 'Barbarian',
    description: 'Rage and fury',
    accentColor: '#dc2626', // Red
  },
  {
    name: 'bard',
    displayName: 'Bard',
    description: 'Performance and charisma',
    accentColor: '#ec4899', // Magenta/Pink
  },
  {
    name: 'cleric',
    displayName: 'Cleric',
    description: 'Divine light',
    accentColor: '#eab308', // Gold/Yellow
  },
  {
    name: 'druid',
    displayName: 'Druid',
    description: 'Nature and wilderness',
    accentColor: '#fb7185', // Rose
  },
  {
    name: 'fighter',
    displayName: 'Fighter',
    description: 'Steel and resolve',
    accentColor: '#64748b', // Slate
  },
  {
    name: 'monk',
    displayName: 'Monk',
    description: 'Discipline and harmony',
    accentColor: '#14b8a6', // Cyan/Teal
  },
  {
    name: 'paladin',
    displayName: 'Paladin',
    description: 'Holy warrior',
    accentColor: '#cbd5e1', // Silver
  },
  {
    name: 'ranger',
    displayName: 'Ranger',
    description: 'Wilderness tracker',
    accentColor: '#15803d', // Forest Green
  },
  {
    name: 'rogue',
    displayName: 'Rogue',
    description: 'Shadows and stealth',
    accentColor: '#6366f1', // Indigo
  },
  {
    name: 'sorcerer',
    displayName: 'Sorcerer',
    description: 'Innate magic',
    accentColor: '#e11d48', // Crimson
  },
  {
    name: 'warlock',
    displayName: 'Warlock',
    description: 'Eldritch pact',
    accentColor: '#a855f7', // Dark Purple
  },
  {
    name: 'wizard',
    displayName: 'Wizard',
    description: 'Arcane knowledge',
    accentColor: '#3b82f6', // Deep Blue
  },
];

const COLOR_THEME_STORAGE_KEY = 'alfira-color-theme';
const MODE_STORAGE_KEY = 'alfira-mode';

interface ThemeContextValue {
  colorTheme: ColorThemeName;
  mode: ColorMode;
  resolvedMode: 'light' | 'dark';
  setColorTheme: (theme: ColorThemeName) => void;
  setMode: (mode: ColorMode) => void;
  colorThemes: ColorTheme[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialColorTheme(): ColorThemeName {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(COLOR_THEME_STORAGE_KEY);
    if (stored && COLOR_THEMES.some((t) => t.name === stored)) {
      return stored as ColorThemeName;
    }
  }
  return 'bard'; // Default to Bard (Spotify-inspired)
}

function getInitialMode(): ColorMode {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(MODE_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'auto') {
      return stored;
    }
  }
  return 'auto'; // Default to auto (follows system)
}

function resolveMode(mode: ColorMode): 'light' | 'dark' {
  if (mode !== 'auto') return mode;
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [colorTheme, setColorThemeState] = useState<ColorThemeName>(getInitialColorTheme);
  const [mode, setModeState] = useState<ColorMode>(getInitialMode);
  const [resolvedMode, setResolvedMode] = useState<'light' | 'dark'>(() =>
    resolveMode(getInitialMode())
  );

  // Resolve mode and listen for system preference changes
  useEffect(() => {
    setResolvedMode(resolveMode(mode));

    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => {
      if (mode === 'auto') setResolvedMode(mq.matches ? 'light' : 'dark');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mode]);

  useEffect(() => {
    document.documentElement.setAttribute('data-color-theme', colorTheme);
    document.documentElement.setAttribute('data-mode', resolvedMode);
    localStorage.setItem(COLOR_THEME_STORAGE_KEY, colorTheme);
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  }, [colorTheme, mode, resolvedMode]);

  return (
    <ThemeContext.Provider
      value={{
        colorTheme,
        mode,
        resolvedMode,
        setColorTheme: setColorThemeState,
        setMode: setModeState,
        colorThemes: COLOR_THEMES,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

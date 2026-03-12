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

export type ColorMode = 'light' | 'dark';

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
    accentColor: '#22c55e', // Green
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
    accentColor: '#fbbf24', // Amber/Gold
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
    accentColor: '#374151', // Charcoal
  },
  {
    name: 'sorcerer',
    displayName: 'Sorcerer',
    description: 'Innate magic',
    accentColor: '#ea580c', // Red-Orange
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
  setColorTheme: (theme: ColorThemeName) => void;
  setMode: (mode: ColorMode) => void;
  toggleMode: () => void;
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
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    // Check system preference
    if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
  }
  return 'dark'; // Default to dark mode
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [colorTheme, setColorThemeState] = useState<ColorThemeName>(getInitialColorTheme);
  const [mode, setModeState] = useState<ColorMode>(getInitialMode);

  useEffect(() => {
    // Apply both attributes to document
    document.documentElement.setAttribute('data-color-theme', colorTheme);
    document.documentElement.setAttribute('data-mode', mode);
    // Persist to localStorage
    localStorage.setItem(COLOR_THEME_STORAGE_KEY, colorTheme);
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  }, [colorTheme, mode]);

  const setColorTheme = (newTheme: ColorThemeName) => {
    setColorThemeState(newTheme);
  };

  const setMode = (newMode: ColorMode) => {
    setModeState(newMode);
  };

  const toggleMode = () => {
    setModeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider
      value={{
        colorTheme,
        mode,
        setColorTheme,
        setMode,
        toggleMode,
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

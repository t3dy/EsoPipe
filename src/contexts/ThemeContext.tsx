import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { ThemeKey, ThemeOption } from '../types';

export const THEMES: ThemeOption[] = [
  { key: 'parchment',     label: 'Parchment',      description: 'Warm manuscript tones — ochre, ink-brown, gold' },
  { key: 'dark-academia', label: 'Dark Academia',   description: 'Deep charcoal and cream with crimson accents' },
  { key: 'journal',       label: 'Academic Journal', description: 'Clean white with navy blue — like a print journal' },
  { key: 'mac80s',        label: '⌘ Mac Classic',   description: 'Black & white, Chicago font, System 7 nostalgia' },
];

interface ThemeCtx {
  theme: ThemeKey;
  setTheme: (t: ThemeKey) => void;
  options: ThemeOption[];
}

const ThemeContext = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeKey>(() => {
    const stored = localStorage.getItem('esopipe-theme');
    return (stored as ThemeKey) ?? 'parchment';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('esopipe-theme', theme);
  }, [theme]);

  const setTheme = (t: ThemeKey) => setThemeState(t);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, options: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

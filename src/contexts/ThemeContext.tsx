/* eslint-disable react-refresh/only-export-components -- The provider and its companion hook intentionally share this context module. */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { syncNativeSystemBars } from '../lib/nativeSystemBars';

type Theme = 'dark' | 'light';
export type ThemeMode = Theme | 'system';

interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const STORAGE_KEY = 'theme';
const SYSTEM_QUERY = '(prefers-color-scheme: dark)';
const defaultMode = (): Theme => (
  /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    ? 'dark'
    : 'light'
);
const ThemeContext = createContext<ThemeContextValue>({ theme: 'dark', mode: 'dark', setMode: () => {}, toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const transitionTimer = useRef<number | null>(null);
  const [mode, setModeState] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : defaultMode();
    } catch {
      return defaultMode();
    }
  });
  const [systemDark, setSystemDark] = useState(() => window.matchMedia(SYSTEM_QUERY).matches);
  const theme: Theme = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;

  useEffect(() => {
    const media = window.matchMedia(SYSTEM_QUERY);
    const updateSystemTheme = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    setSystemDark(media.matches);
    media.addEventListener('change', updateSystemTheme);
    return () => media.removeEventListener('change', updateSystemTheme);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#050505' : '#f8f8fa');
    void syncNativeSystemBars(theme).catch(() => {
      // The web theme remains usable if the Android system UI bridge is unavailable.
    });
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Browsers with storage disabled can still switch theme for this session.
    }
  }, [mode]);

  useEffect(() => () => {
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
    document.documentElement.classList.remove('theme-transitioning');
  }, []);

  const setMode = (nextMode: ThemeMode) => {
    if (nextMode === mode) return;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.documentElement.classList.add('theme-transitioning');
      if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current);
      transitionTimer.current = window.setTimeout(() => {
        document.documentElement.classList.remove('theme-transitioning');
        transitionTimer.current = null;
      }, 180);
    }
    setModeState(nextMode);
  };

  const toggle = () => setMode(theme === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, mode, setMode, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

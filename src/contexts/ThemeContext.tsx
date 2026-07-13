/* eslint-disable react-refresh/only-export-components -- The provider and its companion hook intentionally share this context module. */
import { createContext, useContext, useEffect, type ReactNode } from 'react';

type Theme = 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const STORAGE_KEY = 'theme';
const ThemeContext = createContext<ThemeContextValue>({ theme: 'dark', toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('dark');
    localStorage.setItem(STORAGE_KEY, 'dark');
  }, []);

  const toggle = () => {
    document.documentElement.classList.add('dark');
    localStorage.setItem(STORAGE_KEY, 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme: 'dark', toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

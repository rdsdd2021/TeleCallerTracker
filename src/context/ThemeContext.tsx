import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { lightPalette, darkPalette, Theme } from '../theme';
import { Storage, STORAGE_KEYS } from '../lib/storage';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme:      Theme;
  mode:       ThemeMode;
  isDark:     boolean;
  setMode:    (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme:   lightPalette,
  mode:    'system',
  isDark:  false,
  setMode: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  // Load persisted preference
  useEffect(() => {
    Storage.get(STORAGE_KEYS.THEME_MODE).then(v => {
      if (v === 'light' || v === 'dark' || v === 'system') setModeState(v);
    });
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    Storage.set(STORAGE_KEYS.THEME_MODE, m);
  }, []);

  const isDark =
    mode === 'dark' ||
    (mode === 'system' && systemScheme === 'dark');

  const theme = isDark ? darkPalette : lightPalette;

  return (
    <ThemeContext.Provider value={{ theme, mode, isDark, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ThemeColors {
  mode: 'dark' | 'light';
  background: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  like: string;
  repost: string;
  warning: string;
  danger: string;
  overlay: string;
}

export const DARK_THEME: ThemeColors = {
  mode: 'dark',
  background: '#000000',
  surface: '#16181C',
  border: '#2F3336',
  text: '#E7E9EA',
  textMuted: '#71767B',
  accent: '#1D9BF0',
  like: '#F91880',
  repost: '#00BA7C',
  warning: '#FFD400',
  danger: '#F4212E',
  overlay: 'rgba(91, 112, 131, 0.4)',
};

export const LIGHT_THEME: ThemeColors = {
  mode: 'light',
  background: '#FFFFFF',
  surface: '#EFF3F4',
  border: '#EFF3F4',
  text: '#0F1419',
  textMuted: '#536471',
  accent: '#1D9BF0',
  like: '#F91880',
  repost: '#00BA7C',
  warning: '#FFD400',
  danger: '#F4212E',
  overlay: 'rgba(0, 0, 0, 0.45)',
};

interface ThemeContextValue {
  colors: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: DARK_THEME,
  isDark: true,
  toggleTheme: () => {},
});

const THEME_STORAGE_KEY = '@para_theme_mode';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark') setMode(saved);
    });
  }, []);

  const toggleTheme = () => {
    const next = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    AsyncStorage.setItem(THEME_STORAGE_KEY, next);
  };

  return (
    <ThemeContext.Provider
      value={{
        colors: mode === 'dark' ? DARK_THEME : LIGHT_THEME,
        isDark: mode === 'dark',
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, getColors, ThemeMode } from './theme';

interface ThemeCtx {
  mode: ThemeMode;
  colors: Colors;
  toggle: () => void;
  setMode: (m: ThemeMode) => void;
}

const Ctx = createContext<ThemeCtx>({
  mode: 'dark',
  colors: getColors('dark'),
  toggle: () => {},
  setMode: () => {},
});

const isBrowser = typeof window !== 'undefined';
const canStore = Platform.OS !== 'web' || isBrowser;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    if (!canStore) return;
    AsyncStorage.getItem('theme-mode')
      .then((v) => {
        if (v === 'light' || v === 'dark') setModeState(v);
      })
      .catch(() => {});
  }, []);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    if (canStore) AsyncStorage.setItem('theme-mode', m).catch(() => {});
  };

  const toggle = () => setMode(mode === 'dark' ? 'light' : 'dark');

  return (
    <Ctx.Provider value={{ mode, colors: getColors(mode), toggle, setMode }}>
      {children}
    </Ctx.Provider>
  );
}

export const useTheme = () => useContext(Ctx);

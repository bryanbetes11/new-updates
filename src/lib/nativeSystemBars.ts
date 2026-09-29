import { Capacitor, registerPlugin } from '@capacitor/core';

export type SystemBarTheme = {
  backgroundColor: string;
  darkBackground: boolean;
};

type SystemBarsBridge = {
  applyTheme(options: SystemBarTheme): Promise<void>;
};

let systemBars: SystemBarsBridge | null = null;

export function getSystemBarTheme(theme: 'dark' | 'light'): SystemBarTheme {
  return theme === 'dark'
    ? { backgroundColor: '#050505', darkBackground: true }
    : { backgroundColor: '#f8f8fa', darkBackground: false };
}

export async function syncNativeSystemBars(theme: 'dark' | 'light') {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
  systemBars ??= registerPlugin<SystemBarsBridge>('SystemBars');
  await systemBars.applyTheme(getSystemBarTheme(theme));
}

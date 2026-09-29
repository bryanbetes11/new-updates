import { getSystemBarTheme } from '../src/lib/nativeSystemBars';

function expectEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

const light = getSystemBarTheme('light');
expectEqual(light.backgroundColor, '#f8f8fa', 'light mode matches the app safe-area background');
expectEqual(light.darkBackground, false, 'light mode requests dark status-bar icons');

const dark = getSystemBarTheme('dark');
expectEqual(dark.backgroundColor, '#050505', 'dark mode matches the app safe-area background');
expectEqual(dark.darkBackground, true, 'dark mode requests light status-bar icons');

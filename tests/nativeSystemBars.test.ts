import { getSystemBarTheme } from '../src/lib/nativeSystemBars';
import { readFileSync } from 'node:fs';

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

const androidPlugin = readFileSync(
  new URL('../android/app/src/main/java/com/babcreations/servesync/SystemBarsPlugin.java', import.meta.url),
  'utf8',
);
expectEqual(
  androidPlugin.includes('WindowInsetsCompat.Type.statusBars()'),
  true,
  'Android 15 draws a theme-colored protection view behind the transparent status bar',
);
expectEqual(
  androidPlugin.includes('protection.setBackgroundColor(color)'),
  true,
  'the status-bar protection follows the current ServeSync theme color',
);
expectEqual(
  androidPlugin.includes('controller.setAppearanceLightStatusBars(!darkBackground)'),
  true,
  'status-bar icon contrast follows the current ServeSync theme',
);

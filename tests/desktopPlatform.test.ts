import assert from 'node:assert/strict';
import { desktopPlatformName, hasDesktopUpdater } from '../src/lib/desktopPlatform';
import { desktopUpdates } from '../src/lib/desktopUpdates';

const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
try {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { __TAURI_INTERNALS__: {} } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { platform: 'MacIntel' } });
  // WKWebView uses the Mac platform label on both Intel and Apple Silicon.
  assert.equal(desktopPlatformName(), 'Mac');
  assert.equal(hasDesktopUpdater(), false);
  await desktopUpdates.check(true);
  assert.equal(desktopUpdates.getSnapshot().status, 'idle', 'Mac preview never calls the Windows update feed or native updater API');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { platform: 'Win32' } });
  assert.equal(desktopPlatformName(), 'Windows');
  assert.equal(hasDesktopUpdater(), true, 'Windows retains its signed updater');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
  assert.equal(hasDesktopUpdater(), false, 'an ordinary Windows browser never uses the native updater');
} finally {
  if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow);
  else Reflect.deleteProperty(globalThis, 'window');
  if (oldNavigator) Object.defineProperty(globalThis, 'navigator', oldNavigator);
  else Reflect.deleteProperty(globalThis, 'navigator');
}

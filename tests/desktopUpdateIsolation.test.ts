import assert from 'node:assert/strict';
import { isDesktopApp } from '../src/lib/desktopPlatform';
import { applyPendingAppUpdate, checkForAppUpdate, registerAppServiceWorker } from '../src/lib/serviceWorkerUpdate';

const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
try {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
  assert.equal(isDesktopApp(), false, 'ordinary website must keep its web updater');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { __TAURI_INTERNALS__: {} },
  });
  assert.equal(isDesktopApp(), true);
  // No navigator or browser cache APIs: any accidental use fails this test.
  registerAppServiceWorker();
  assert.equal((await checkForAppUpdate()).status, 'native-managed');
  assert.equal(await applyPendingAppUpdate(), false);
} finally {
  if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
  else Reflect.deleteProperty(globalThis, 'window');
}

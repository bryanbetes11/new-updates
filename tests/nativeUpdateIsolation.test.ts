import { Capacitor } from '@capacitor/core';
import { applyPendingAppUpdate, checkForAppUpdate, registerAppServiceWorker } from '../src/lib/serviceWorkerUpdate';

// Native callers must return before touching browser worker/cache APIs.
// SSR has no browser globals, so accidental browser access fails this check.
const originalNativeCheck = Capacitor.isNativePlatform;
try {
  Capacitor.isNativePlatform = () => true;
  registerAppServiceWorker();
  const update = await checkForAppUpdate();
  if (update.status !== 'native-managed') throw new Error('Native checks must not report website update status.');
  if (await applyPendingAppUpdate()) throw new Error('Native builds must never activate a web update or reload.');
} finally {
  Capacitor.isNativePlatform = originalNativeCheck;
}

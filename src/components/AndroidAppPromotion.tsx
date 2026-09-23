import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isAndroidDevice, isStandalonePwa } from '../lib/device';
import { isNativeApp } from '../lib/nativePlatform';
import { ANDROID_TEST_RELEASE, shouldOfferAndroidApp } from '../lib/androidDownload';
import { Modal } from './Modal';

const dismissalKey = `servesync:android-app-offer:${ANDROID_TEST_RELEASE.build}`;

export function AndroidAppPromotion() {
  const { user, loading } = useAuth();
  const { pathname, search } = useLocation();
  // Local preview uses the real dialog without changing device detection or saved preferences.
  const preview = import.meta.env.DEV && pathname === '/download/android' && new URLSearchParams(search).get('preview') === 'app-offer';
  const [previewDismissed, setPreviewDismissed] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(dismissalKey) === 'dismissed'; } catch { return false; }
  });
  const dismiss = () => {
    if (preview) { setPreviewDismissed(true); return; }
    setDismissed(true);
    try { localStorage.setItem(dismissalKey, 'dismissed'); } catch { /* Session dismissal still works. */ }
  };
  const show = shouldOfferAndroidApp({ android: isAndroidDevice(), standalone: isStandalonePwa(), native: isNativeApp(), signedIn: Boolean(user) && !loading, dashboard: pathname === '/dashboard', dismissed });
  return (
    <Modal open={preview ? !previewDismissed : show} onClose={dismiss} title="ServeSync for Android" size="sm" mobileView="dialog">
      <div className="space-y-5 pb-2">
        <img src="/pwa-icon-192.png" alt="" className="h-16 w-16 rounded-2xl" />
        <div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">The Android app is ready to try.</p>
          <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">Get the testing APK with Android notifications and Chat. Sign in with your existing ServeSync account.</p>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Version {ANDROID_TEST_RELEASE.version} · Build {ANDROID_TEST_RELEASE.build} · Manual installation</p>
        </div>
        <Link to="/download/android" onClick={dismiss} className="flex min-h-12 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white">Download &amp; installation guide</Link>
        <button type="button" onClick={dismiss} className="min-h-11 w-full rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300">Keep using the PWA</button>
      </div>
    </Modal>
  );
}

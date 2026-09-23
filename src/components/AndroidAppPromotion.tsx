import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ANDROID_TEST_RELEASE, isAndroidOfferDue } from '../lib/androidDownload';
import { useAndroidAppPopupAvailable } from '../contexts/androidAppOfferContext';
import { Modal } from './Modal';

export function AndroidAppPromotion() {
  const { user } = useAuth();
  const { pathname, search } = useLocation();
  // Local preview uses the real dialog without changing device detection or saved preferences.
  const preview = import.meta.env.DEV && pathname === '/download/android' && new URLSearchParams(search).get('preview') === 'app-offer';
  const [previewDismissed, setPreviewDismissed] = useState(false);
  const [open, setOpen] = useState(false);
  const sessionShown = useRef(new Map<string, number>());
  const eligible = useAndroidAppPopupAvailable();
  useEffect(() => {
    setOpen(false);
    if (!eligible || !user?.id) return;
    const key = `servesync:android-app-offer:last-shown:${user.id}`;
    const check = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return;
      let lastShown = sessionShown.current.get(key) ?? null;
      try {
        const saved = localStorage.getItem(key);
        if (saved !== null) lastShown = Math.max(lastShown ?? 0, Number(saved));
      } catch { /* In-memory cooldown still prevents repeat prompts this session. */ }
      if (!isAndroidOfferDue(lastShown, Date.now(), false)) return;
      const shownAt = Date.now();
      sessionShown.current.set(key, shownAt);
      try { localStorage.setItem(key, String(shownAt)); } catch { /* Session cooldown remains. */ }
      setOpen(true);
    };
    const refresh = () => { void check(); };
    refresh();
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [eligible, user?.id]);
  const dismiss = () => {
    if (preview) { setPreviewDismissed(true); return; }
    setOpen(false);
  };
  return (
    <Modal open={preview ? !previewDismissed : eligible && open} onClose={dismiss} title="ServeSync for Android" size="sm" mobileView="dialog">
      <div className="space-y-5 pb-2">
        <img src="/pwa-icon-192.png" alt="" className="h-16 w-16 rounded-2xl" />
        <div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">The Android app is ready to try.</p>
          <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">Get the testing APK with Android notifications and Chat. Sign in with your existing ServeSync account.</p>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Version {ANDROID_TEST_RELEASE.version} · Build {ANDROID_TEST_RELEASE.build} · Manual installation</p>
        </div>
        <Link to="/download/android" onClick={dismiss} className="flex min-h-12 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white">Download &amp; installation guide</Link>
        <button type="button" onClick={dismiss} className="min-h-11 w-full rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300">Remind me tomorrow</button>
      </div>
    </Modal>
  );
}

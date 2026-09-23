import { useEffect, useState, useSyncExternalStore } from 'react';
import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { Download, X } from 'lucide-react';
import { androidUpdates, downloadAndroidUpdate, installAndroidUpdate, isAndroidApp, isAndroidUpdateDownloaded, subscribeAndroidUpdateProgress } from '../lib/nativeAppUpdates';

export function NativeAppUpdateWatcher() {
  useEffect(() => {
    if (!isAndroidApp()) return;
    let disposed = false;
    let handle: PluginListenerHandle | undefined;
    const check = () => {
      if (!disposed && document.visibilityState === 'visible') void androidUpdates.check();
    };
    check();
    void App.addListener('appStateChange', state => { if (state.isActive) check(); })
      .then(listener => { if (disposed) void listener.remove(); else handle = listener; })
      .catch(() => { /* Visibility/online events still trigger checks. */ });
    document.addEventListener('visibilitychange', check);
    window.addEventListener('online', check);
    const timer = window.setInterval(check, 6 * 60 * 60 * 1000);
    return () => {
      disposed = true;
      void handle?.remove();
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('online', check);
      window.clearInterval(timer);
    };
  }, []);
  return null;
}

export function NativeAppUpdateCard({ alwaysVisible = false }: { alwaysVisible?: boolean }) {
  const snapshot = useSyncExternalStore(androidUpdates.subscribe, androidUpdates.getSnapshot);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [prepared, setPrepared] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const release = snapshot.release;
  const releaseKey = release ? `${release.build}:${release.sha256}` : null;
  const legacyUpdater = (snapshot.installedBuild ?? 0) < 15;
  const ready = !legacyUpdater && prepared !== null && prepared === releaseKey;

  useEffect(() => {
    setPrepared(null);
    setProgress(null);
    setError('');
    setMessage('');
  }, [snapshot.installedBuild, releaseKey]);

  useEffect(() => {
    if (!isAndroidApp() || !release || legacyUpdater) return;
    let active = true;
    void isAndroidUpdateDownloaded(release).then(found => {
      if (active) setPrepared(found ? `${release.build}:${release.sha256}` : null);
    }).catch(() => { if (active) setPrepared(null); });
    return () => { active = false; };
  }, [release, legacyUpdater]);

  useEffect(() => {
    if (!isAndroidApp() || legacyUpdater) return;
    let active = true;
    let handle: PluginListenerHandle | undefined;
    void subscribeAndroidUpdateProgress(update => {
      if (active && update.build === release?.build) setProgress(update.percent);
    }).then(listener => { if (active) handle = listener; else void listener.remove(); }).catch(() => {});
    return () => { active = false; void handle?.remove(); };
  }, [release?.build, legacyUpdater]);

  if (!isAndroidApp() || !release || (!alwaysVisible && dismissed === release.build)) return null;
  const act = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (ready) {
        const result = await installAndroidUpdate(release);
        setMessage(result.action === 'settings'
          ? 'Allow installs from ServeSync in Android settings, then return and tap Install update again.'
          : 'Confirm Update in the Android installer to finish.');
      } else {
        setProgress(null);
        const action = await downloadAndroidUpdate(release.build);
        if (action === 'downloaded') {
          setPrepared(releaseKey);
          setMessage('Download complete. Tap Install update when you’re ready.');
        } else {
          setMessage('Open the downloaded APK in your browser, then confirm Update in Android. Future updates will download inside ServeSync.');
        }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not prepare the update. Please try again.');
    } finally { setBusy(false); }
  };
  return (
    <section aria-label="Android app update" className="mx-auto mb-4 max-w-7xl rounded-2xl border border-emerald-400/25 bg-emerald-950 p-4 text-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold">ServeSync {release.version} is available</h2>
          <p className="mt-1 text-xs text-emerald-100/80">Android build {release.build} · {(release.size / 1024 / 1024).toFixed(1)} MB</p>
        </div>
        {!alwaysVisible && <button type="button" aria-label="Dismiss update notice" className="-mr-2 -mt-2 grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-white/10" onClick={() => setDismissed(release.build)}><X className="h-4 w-4" /></button>}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-emerald-100/80">{legacyUpdater ? 'This one update opens in your browser. After installing it, future updates download inside ServeSync.' : 'Download securely inside ServeSync, then tap Install update. Android will ask you to confirm. Your existing app data is kept.'}</p>
      <button type="button" disabled={busy} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-bold text-emerald-950 disabled:opacity-50" onClick={() => void act()}><Download className="h-4 w-4" />{busy ? (ready ? 'Opening installer…' : legacyUpdater ? 'Opening browser…' : progress === null ? 'Preparing download…' : `Downloading… ${progress}%`) : ready ? 'Install update' : legacyUpdater ? 'Open download in browser' : 'Download update'}</button>
      {message && <p role="status" className="mt-2 text-xs text-emerald-100/80">{message}</p>}
      {error && <p role="alert" className="mt-2 text-xs text-amber-200">{error}</p>}
    </section>
  );
}

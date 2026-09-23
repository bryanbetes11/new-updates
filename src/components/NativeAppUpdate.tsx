import { useEffect, useState, useSyncExternalStore } from 'react';
import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { Download, X } from 'lucide-react';
import { androidUpdates, downloadAndroidUpdate, isAndroidApp } from '../lib/nativeAppUpdates';

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
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');
  const release = snapshot.release;
  if (!isAndroidApp() || !release || (!alwaysVisible && dismissed === release.build)) return null;
  return (
    <section aria-label="Android app update" className="mx-auto mb-4 max-w-7xl rounded-2xl border border-emerald-400/25 bg-emerald-950 p-4 text-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold">ServeSync {release.version} is available</h2>
          <p className="mt-1 text-xs text-emerald-100/80">Android build {release.build} · {(release.size / 1024 / 1024).toFixed(1)} MB</p>
        </div>
        {!alwaysVisible && <button type="button" aria-label="Dismiss update notice" className="-mr-2 -mt-2 grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-white/10" onClick={() => setDismissed(release.build)}><X className="h-4 w-4" /></button>}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-emerald-100/80">Download the APK, then open it and choose Update. Android will ask you to confirm installation. Your existing app data is kept.</p>
      <button type="button" disabled={opening} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-bold text-emerald-950 disabled:opacity-50" onClick={() => {
        setOpening(true); setError('');
        void downloadAndroidUpdate().catch(reason => setError(reason instanceof Error ? reason.message : 'Could not open the download. Please try again.')).finally(() => setOpening(false));
      }}><Download className="h-4 w-4" />{opening ? 'Checking download…' : 'Download update'}</button>
      {error && <p role="alert" className="mt-2 text-xs text-amber-200">{error}</p>}
    </section>
  );
}

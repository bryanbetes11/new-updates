import { useEffect, useState, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { desktopUpdates } from '../lib/desktopUpdates';
import { hasDesktopUpdater, isDesktopApp } from '../lib/desktopPlatform';
import { getActiveServiceMode } from '../lib/serviceModeResume';

export function DesktopAppUpdateCard({ compact = false, controller = desktopUpdates }: { compact?: boolean; controller?: typeof desktopUpdates }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const busy = state.status === 'downloading' || state.status === 'installing';
  if (!isDesktopApp()) return null;
  if (!hasDesktopUpdater()) return <MacAppVersion />;
  return (
    <div className="space-y-3" aria-label="Windows app updates">
      {!compact && <p className="text-sm text-gray-500 dark:text-gray-400">{state.installedVersion ? `Windows version ${state.installedVersion}. ` : ''}Checks automatically. Installs only when you choose.</p>}
      {state.version && <p className="font-bold text-gray-950 dark:text-white">ServeSync {state.version} is available</p>}
      {!compact && state.notes && <p className="whitespace-pre-line text-sm text-gray-600 dark:text-gray-300">{state.notes}</p>}
      {state.version && <p className="text-sm text-gray-600 dark:text-gray-300">Save your work first. ServeSync will close and reopen after installation.</p>}
      <div className="flex flex-wrap gap-2">
        {state.version && <button type="button" disabled={busy || state.status === 'checking'} onClick={() => void controller.install()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin motion-reduce:animate-none' : ''}`} />
          {state.status === 'downloading' ? `Downloading${state.progress === undefined ? '…' : ` ${state.progress}%`}` : state.status === 'installing' ? 'Verifying and installing…' : 'Install and restart'}
        </button>}
        {!compact && <button type="button" disabled={busy || state.status === 'checking'} onClick={() => void controller.check(true)} className="min-h-11 rounded-xl border border-gray-300 px-4 text-sm font-bold text-gray-800 disabled:opacity-50 dark:border-white/20 dark:text-white">{state.status === 'checking' ? 'Checking…' : 'Check for updates'}</button>}
      </div>
      <p role="status" aria-live="polite" className="text-sm text-gray-600 dark:text-gray-300">{state.message || (state.status === 'current' ? 'Your Windows app is up to date.' : busy ? 'Keep ServeSync open while the update is prepared.' : '')}</p>
    </div>
  );
}

function MacAppVersion() {
  const [version, setVersion] = useState('');
  useEffect(() => {
    let active = true;
    void import('@tauri-apps/api/app').then(api => api.getVersion()).then(value => {
      if (active) setVersion(value);
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  return <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
    {version && <p>Mac version {version}.</p>}
    <p>This Mac test build updates through a new installer. Quit ServeSync, then replace it in Applications with the newer version.</p>
  </div>;
}

export function DesktopAppUpdateWatcher() {
  const location = useLocation();
  const state = useSyncExternalStore(desktopUpdates.subscribe, desktopUpdates.getSnapshot);
  const [dismissedVersion, setDismissedVersion] = useState('');
  useEffect(() => {
    if (!hasDesktopUpdater()) return;
    const check = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) void desktopUpdates.check();
    };
    const startup = window.setTimeout(check, 30_000);
    const timer = window.setInterval(check, 60_000);
    window.addEventListener('online', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearTimeout(startup);
      window.clearInterval(timer);
      window.removeEventListener('online', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  if (!hasDesktopUpdater() || !state.version || state.version === dismissedVersion || ['/settings', '/settings/app'].includes(location.pathname) || getActiveServiceMode()) return null;
  return (
    <aside aria-label="Windows update available" className="fixed bottom-5 right-5 z-[80] w-[min(380px,calc(100vw-40px))] space-y-3 rounded-2xl border border-emerald-200 bg-white p-5 shadow-xl dark:border-emerald-800 dark:bg-gray-950">
      <DesktopAppUpdateCard compact />
      {state.status !== 'downloading' && state.status !== 'installing' && <button type="button" onClick={() => setDismissedVersion(state.version || '')} className="min-h-10 text-sm font-semibold text-gray-600 dark:text-gray-300">Later</button>}
    </aside>
  );
}

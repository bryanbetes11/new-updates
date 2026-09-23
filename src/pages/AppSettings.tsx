import { useEffect, useState } from 'react';
import { App } from '@capacitor/app';
import { RefreshCw, Settings } from 'lucide-react';
import { NativeAppUpdateCard } from '../components/NativeAppUpdate';
import { DeviceCacheSetting } from '../components/DeviceCacheSetting';
import { APP_VERSION_LABEL } from '../lib/appUpdate';
import { checkForAppUpdate } from '../lib/serviceWorkerUpdate';
import { androidUpdates, isAndroidApp } from '../lib/nativeAppUpdates';
import { useAuth } from '../contexts/AuthContext';

export function AppSettings() {
  const { offlineMode, retryOnline } = useAuth();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');
  const [connectionMessage, setConnectionMessage] = useState('');
  const [installed, setInstalled] = useState<{ version: string; build: string } | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  useEffect(() => {
    if (!isAndroidApp()) return;
    let active = true;
    void App.getInfo().then(info => { if (active) setInstalled(info); }).catch(() => {});
    return () => { active = false; };
  }, []);

  const check = async () => {
    setChecking(true);
    setMessage('');
    try {
      if (isAndroidApp()) {
        const result = await androidUpdates.check(true);
        if (result.status === 'available') setMessage(`ServeSync ${result.release?.version} is available. Use Download update below.`);
        else if (result.status === 'up-to-date') setMessage(`Android build ${result.installedBuild} is up to date.`);
        else setMessage('Could not check Android releases. Check your connection and try again.');
      } else {
        const result = await checkForAppUpdate();
        if (result.status === 'up-to-date') setMessage(`ServeSync ${APP_VERSION_LABEL} is up to date.`);
        else if (result.status === 'available') setMessage(`ServeSync v${result.manifest.version} is being prepared.`);
        else if (result.status === 'native-managed') setMessage('This installed app updates through a new app version. Website updates do not update this installation.');
        else setMessage('Could not check for updates. Check your connection and try again.');
      }
    } catch {
      setMessage('Could not check for updates. Check your connection and try again.');
    } finally { setChecking(false); }
  };

  return (
    <div className="page-container page-bottom-pad">
      <div className="app-content-shell mx-auto max-w-2xl space-y-5 pt-4 sm:pt-5">
        <header className="rounded-3xl border border-gray-200/80 bg-white p-5 dark:border-white/[0.07] dark:bg-white/[0.025] sm:p-7">
          <Settings className="mb-3 h-6 w-6 text-emerald-600 dark:text-emerald-300" />
          <h1 className="text-2xl font-black tracking-tight text-gray-950 dark:text-white">App settings</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Manage updates and content saved on this device.</p>
        </header>
        {offlineMode && (
          <section className="rounded-3xl border border-gray-200/80 bg-white p-5 dark:border-white/[0.07] dark:bg-white/[0.025] sm:p-6">
            <h2 className="text-base font-bold text-gray-950 dark:text-white">Connection</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Your saved content remains available. Reconnect to refresh it and use team actions.</p>
            <button type="button" disabled={reconnecting} onClick={() => {
              setReconnecting(true);
              setConnectionMessage('');
              void retryOnline().then(result => setConnectionMessage(result.error?.message || '')).catch(() => setConnectionMessage('Could not reconnect. Try again when internet is available.')).finally(() => setReconnecting(false));
            }} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${reconnecting ? 'animate-spin' : ''}`} />{reconnecting ? 'Connecting…' : 'Reconnect'}
            </button>
            {connectionMessage && <p role="status" className="mt-2 text-sm text-gray-600 dark:text-gray-300">{connectionMessage}</p>}
          </section>
        )}
        <section aria-labelledby="app-updates-title" className="space-y-4 rounded-3xl border border-gray-200/80 bg-white p-5 dark:border-white/[0.07] dark:bg-white/[0.025] sm:p-6">
          <div>
            <h2 id="app-updates-title" className="text-base font-bold text-gray-950 dark:text-white">App updates</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">ServeSync {installed ? `v${installed.version} · Android build ${installed.build}` : APP_VERSION_LABEL}</p>
          </div>
          <button type="button" onClick={() => void check()} disabled={checking} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin motion-reduce:animate-none' : ''}`} />
            {checking ? 'Checking…' : 'Check for updates'}
          </button>
          {message && <p role="status" className="text-sm text-gray-600 dark:text-gray-300">{message}</p>}
          <NativeAppUpdateCard alwaysVisible />
        </section>
        <DeviceCacheSetting />
      </div>
    </div>
  );
}

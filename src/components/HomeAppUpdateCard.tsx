import { useEffect, useState } from 'react';
import { Download, RefreshCw, Sparkles } from 'lucide-react';
import {
  APP_UPDATE_AVAILABLE_EVENT,
  applyPendingAppUpdate,
  getPendingAppUpdate,
  hasPendingAppUpdate,
  type PendingAppUpdate,
} from '../lib/serviceWorkerUpdate';

export function HomeAppUpdateCard() {
  const [update, setUpdate] = useState<PendingAppUpdate | null>(() => (
    hasPendingAppUpdate() ? getPendingAppUpdate() : null
  ));
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const handleUpdate = (event: Event) => {
      setUpdate((event as CustomEvent<PendingAppUpdate>).detail);
    };
    window.addEventListener(APP_UPDATE_AVAILABLE_EVENT, handleUpdate);
    return () => window.removeEventListener(APP_UPDATE_AVAILABLE_EVENT, handleUpdate);
  }, []);

  if (!update) return null;

  return (
    <section
      className="relative overflow-hidden rounded-[1.1rem] border border-emerald-400/20 bg-[#111b15] p-4 shadow-[0_24px_70px_-42px_rgba(34,197,94,0.8)] sm:p-5"
      aria-labelledby="home-app-update-title"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(34,197,94,0.22),transparent_36%),linear-gradient(135deg,rgba(34,197,94,0.08),transparent_58%)]" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/12 text-emerald-300">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300/75">App update ready</p>
            <h2 id="home-app-update-title" className="mt-1 text-[16px] font-black tracking-[-0.025em] text-white">
              ServeSync v{update.version} is ready to install.
            </h2>
            <p className="mt-1 text-[12px] leading-relaxed text-white/45">
              {update.required
                ? 'This update is required to keep ServeSync compatible with the latest services.'
                : 'Install the latest features and fixes whenever you are ready.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setInstalling(true);
            void applyPendingAppUpdate();
          }}
          disabled={installing}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 text-[12px] font-black text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
        >
          {installing ? <RefreshCw className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Download className="h-4 w-4" />}
          {installing ? 'Installing…' : 'Update ServeSync'}
        </button>
      </div>
    </section>
  );
}

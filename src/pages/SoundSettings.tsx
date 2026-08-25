import { Settings2, Volume2 } from 'lucide-react';
import { InteractionSoundSettingsPanel } from '../components/InteractionSoundSettingsPanel';

export function SoundSettings() {
  return (
    <div className="page-container page-bottom-pad">
      <div className="app-content-shell mx-auto max-w-2xl space-y-5">
        <div className="rounded-3xl border border-gray-200/80 bg-white p-5 shadow-sm dark:border-white/[0.07] dark:bg-white/[0.025] sm:p-7">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
              <Volume2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-300">Settings</p>
              <h1 className="mt-1 text-2xl font-black tracking-[-0.03em] text-gray-950 dark:text-white">Sound & feedback</h1>
              <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-white/48">Choose how responsive ServeSync should feel on this device.</p>
            </div>
            <Settings2 className="ml-auto h-5 w-5 text-gray-300 dark:text-white/20" />
          </div>
        </div>

        <section className="rounded-3xl border border-gray-200/80 bg-white p-5 shadow-sm dark:border-white/[0.07] dark:bg-white/[0.025] sm:p-6">
          <InteractionSoundSettingsPanel />
        </section>
      </div>
    </div>
  );
}

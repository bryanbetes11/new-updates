import { Download, Sparkles, Wrench } from 'lucide-react';
import { Modal } from './Modal';
import { APP_UPDATE_FEATURES, APP_UPDATE_FIXES } from '../lib/appUpdate';

interface AppUpdateModalProps {
  open: boolean;
  currentVersion: string;
  targetVersion: string;
  onUpdate: () => void;
  applying: boolean;
}

function formatVersionLabel(version: string) {
  return version.startsWith('v') ? version : `v${version}`;
}

function ChangeList({ items, color }: { items: string[]; color: string }) {
  return (
    <ul className="space-y-2">
      {items.map(item => (
        <li key={item} className="flex items-start gap-2 text-[13px] leading-relaxed text-gray-600 dark:text-white/55">
          <span className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${color}`} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function AppUpdateModal({
  open,
  currentVersion,
  targetVersion,
  onUpdate,
  applying,
}: AppUpdateModalProps) {
  return (
    <Modal
      open={open}
      onClose={() => {}}
      title="Update Available"
      size="md"
      titleAlign="center"
      hideCloseButton
      closeOnBackdrop={false}
      closeOnEscape={false}
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
            <Download className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[16px] font-bold text-gray-900 dark:text-white">A new version of ServeSync is ready.</p>
            <p className="mt-1 text-[13px] leading-relaxed text-gray-500 dark:text-white/50">
              Update now to load the latest build without reinstalling the app.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono uppercase tracking-[0.18em] text-gray-400 dark:text-white/30">
              <span>Installed {formatVersionLabel(currentVersion)}</span>
              <span>Latest {formatVersionLabel(targetVersion)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200/80 bg-gray-50/80 dark:border-white/[0.08] dark:bg-white/[0.04] divide-y divide-gray-200/80 dark:divide-white/[0.06] overflow-hidden">
          {APP_UPDATE_FEATURES.length > 0 && (
            <div className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-gray-700 dark:text-white/70">New Features</p>
              </div>
              <ChangeList items={APP_UPDATE_FEATURES} color="bg-emerald-500" />
            </div>
          )}
          {APP_UPDATE_FIXES.length > 0 && (
            <div className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Wrench className="h-4 w-4 text-amber-500" />
                <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-gray-700 dark:text-white/70">Fixes</p>
              </div>
              <ChangeList items={APP_UPDATE_FIXES} color="bg-amber-400" />
            </div>
          )}
        </div>

        <div className="pt-1">
          <button
            onClick={onUpdate}
            disabled={applying}
            className="w-full h-10 rounded-xl bg-emerald-500 text-[13px] font-semibold text-white transition-colors hover:bg-emerald-600 disabled:opacity-45"
          >
            {applying ? 'Updating…' : 'Update Now'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

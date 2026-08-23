import { Download, Sparkles, Wrench } from 'lucide-react';
import { Modal } from './Modal';
import { APP_UPDATE_FEATURES, APP_UPDATE_FIXES } from '../lib/appUpdate';

interface AppUpdateModalProps {
  open: boolean;
  currentVersion: string;
  targetVersion: string;
  onUpdate: () => void;
  onLater: () => void;
  applying: boolean;
  required: boolean;
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
  onLater,
  applying,
  required,
}: AppUpdateModalProps) {
  return (
    <Modal
      open={open}
      onClose={required ? () => {} : onLater}
      title={required ? 'Update Required' : 'Update Available'}
      size="md"
      mobileView="dialog"
      titleAlign="center"
      hideCloseButton={required}
      closeOnBackdrop={!required}
      closeOnEscape={!required}
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
            <Download className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[16px] font-bold text-gray-900 dark:text-white">
              {required ? 'ServeSync needs to update before you continue.' : 'A fresh ServeSync update is ready.'}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-gray-500 dark:text-white/50">
              {required
                ? 'This version is no longer compatible with the latest ServeSync services. Your account and saved information are safe.'
                : 'Install it now, or keep working and update when you are ready.'}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono uppercase tracking-[0.18em] text-gray-400 dark:text-white/30">
              <span>Installed {formatVersionLabel(currentVersion)}</span>
              <span>Latest {formatVersionLabel(targetVersion)}</span>
            </div>
          </div>
        </div>

        <div className="max-h-[min(46dvh,26rem)] overflow-y-auto rounded-2xl border border-gray-200/80 bg-gray-50/80 dark:border-white/[0.08] dark:bg-white/[0.04] divide-y divide-gray-200/80 dark:divide-white/[0.06]">
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

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row">
          {!required && (
            <button
              type="button"
              onClick={onLater}
              disabled={applying}
              className="h-11 flex-1 rounded-xl border border-gray-200 bg-white text-[13px] font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-45 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/60 dark:hover:bg-white/[0.07]"
            >
              Later
            </button>
          )}
          <button
            type="button"
            onClick={onUpdate}
            disabled={applying}
            className="h-11 flex-[1.4] rounded-xl bg-emerald-500 text-[13px] font-semibold text-white transition-colors hover:bg-emerald-600 disabled:opacity-45"
          >
            {applying ? 'Installing Update...' : 'Update ServeSync'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

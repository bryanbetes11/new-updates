import { Download, Sparkles } from 'lucide-react';
import { Modal } from './Modal';

interface AppUpdateModalProps {
  open: boolean;
  currentVersion: string;
  targetVersion: string;
  currentBuildNumber?: number;
  targetBuildNumber?: number;
  headline?: string;
  highlights?: string[];
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
  currentBuildNumber,
  targetBuildNumber,
  headline,
  highlights = [],
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
              {currentBuildNumber ? <span>Build {currentBuildNumber}</span> : null}
              {targetBuildNumber ? <span>New build {targetBuildNumber}</span> : null}
            </div>
          </div>
        </div>

        {highlights.length > 0 && (
          <div className="rounded-2xl border border-gray-200/80 bg-gray-50/80 p-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-500" />
              <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-gray-700 dark:text-white/70">{headline || 'What changed'}</p>
            </div>
            <ChangeList items={highlights.slice(0, 3)} color="bg-emerald-500" />
          </div>
        )}

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

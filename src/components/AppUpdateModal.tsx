import { Download } from 'lucide-react';
import { Modal } from './Modal';

interface AppUpdateModalProps {
  open: boolean;
  onUpdate: () => void;
  onLater: () => void;
  applying: boolean;
  required: boolean;
}

export function AppUpdateModal({
  open,
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
              {required ? 'Update required' : 'New update detected'}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-gray-500 dark:text-white/50">
              {required
                ? 'Install the latest ServeSync update to continue.'
                : 'A newer ServeSync update is ready. You can install it now or keep working and update later.'}
            </p>
          </div>
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
            {applying ? 'Installing Update...' : 'Update now'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

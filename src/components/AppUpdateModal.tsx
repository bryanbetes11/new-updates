import { Download } from 'lucide-react';
import { Modal } from './Modal';

interface AppUpdateModalProps {
  open: boolean;
  onUpdate: () => void;
  applying: boolean;
}

export function AppUpdateModal({
  open,
  onUpdate,
  applying,
}: AppUpdateModalProps) {
  return (
    <Modal
      open={open}
      onClose={() => {}}
      title="New update detected"
      size="md"
      mobileView="dialog"
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
            <p className="text-[16px] font-bold text-gray-900 dark:text-white">
              Update ready
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-gray-500 dark:text-white/50">
              Install the latest ServeSync update to continue.
            </p>
          </div>
        </div>

        <p className="rounded-xl border border-emerald-200/70 bg-emerald-50/70 px-3 py-2.5 text-[12px] font-medium leading-5 text-emerald-950 dark:border-emerald-400/15 dark:bg-emerald-400/[0.07] dark:text-emerald-100/85">
          Nothing has been deleted. The message, setlist, or page you are working on stays in place until the update starts. Any saved changes remain after installation.
        </p>

        <div className="pt-1">
          <button
            type="button"
            onClick={onUpdate}
            disabled={applying}
            className="h-11 w-full rounded-xl bg-emerald-500 text-[13px] font-semibold text-white transition-colors hover:bg-emerald-600 disabled:opacity-45"
          >
            {applying ? 'Installing Update...' : 'Update now'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

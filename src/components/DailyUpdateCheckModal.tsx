import { AlertCircle, CheckCircle2, RefreshCw, Sparkles } from 'lucide-react';
import { Modal } from './Modal';
import { APP_BUILD_ID, APP_VERSION_LABEL } from '../lib/appUpdate';

export type DailyUpdateCheckStatus = 'checking' | 'current' | 'available' | 'error';

interface DailyUpdateCheckModalProps {
  open: boolean;
  status: DailyUpdateCheckStatus;
  latestVersion?: string;
  onClose: () => void;
  onRetry: () => void;
  onViewReleaseNotes: () => void;
}

export function DailyUpdateCheckModal({
  open,
  status,
  latestVersion,
  onClose,
  onRetry,
  onViewReleaseNotes,
}: DailyUpdateCheckModalProps) {
  const isChecking = status === 'checking';
  const isCurrent = status === 'current';
  const isAvailable = status === 'available';
  const Icon = isChecking ? RefreshCw : isCurrent ? CheckCircle2 : isAvailable ? Sparkles : AlertCircle;
  const iconTone = isCurrent
    ? 'bg-emerald-500 text-white'
    : isAvailable
      ? 'bg-sky-500 text-white'
      : status === 'error'
        ? 'bg-amber-500 text-black'
        : 'bg-emerald-500/15 text-emerald-300';

  const title = isChecking
    ? 'Checking for updates…'
    : isCurrent
      ? 'ServeSync is up to date.'
      : isAvailable
        ? `ServeSync v${latestVersion || 'latest'} is on the way.`
        : 'We couldn’t verify the latest version.';

  const description = isChecking
    ? 'Comparing this installation with the latest published ServeSync release.'
    : isCurrent
      ? 'You are using the latest published app version. We’ll automatically check again tomorrow.'
      : isAvailable
        ? 'The new app shell is being prepared. An Update ServeSync prompt will appear as soon as it is ready to install.'
        : 'Your current app will continue working. Check your connection and try the update check again.';

  return (
    <Modal
      open={open}
      onClose={isChecking ? () => {} : onClose}
      title="Daily app check"
      size="sm"
      mobileView="dialog"
      hideCloseButton={isChecking}
      closeOnBackdrop={!isChecking}
      closeOnEscape={!isChecking}
    >
      <div className="space-y-5">
        <div className="rounded-3xl border border-white/[0.07] bg-gradient-to-br from-emerald-500/[0.10] via-white/[0.025] to-sky-500/[0.06] p-5 text-center">
          <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl shadow-xl ${iconTone}`}>
            <Icon className={`h-6 w-6 ${isChecking ? 'animate-spin motion-reduce:animate-none' : ''}`} />
          </div>
          <p className="mt-4 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-emerald-300/75">
            {APP_VERSION_LABEL} · Build {APP_BUILD_ID}
          </p>
          <h3 className="mt-2 text-[20px] font-black tracking-[-0.035em] text-white">{title}</h3>
          <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-white/50">{description}</p>
        </div>

        {!isChecking && (
          <div className="flex flex-col-reverse gap-2 min-[390px]:flex-row">
            {isCurrent ? (
              <button
                type="button"
                onClick={onViewReleaseNotes}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-[13px] font-semibold text-white/65 transition-colors hover:bg-white/[0.07]"
              >
                <Sparkles className="h-4 w-4 text-emerald-400" /> What’s New
              </button>
            ) : status === 'error' ? (
              <button
                type="button"
                onClick={onClose}
                className="h-11 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] text-[13px] font-semibold text-white/65 transition-colors hover:bg-white/[0.07]"
              >
                Not now
              </button>
            ) : null}
            <button
              type="button"
              onClick={status === 'error' ? onRetry : onClose}
              className="inline-flex h-11 flex-[1.2] items-center justify-center gap-2 rounded-xl bg-emerald-500 text-[13px] font-bold text-white transition-colors hover:bg-emerald-600"
            >
              {status === 'error' ? <><RefreshCw className="h-4 w-4" /> Try Again</> : isAvailable ? 'Okay' : 'Done'}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

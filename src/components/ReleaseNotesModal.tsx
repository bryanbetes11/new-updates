import { Calendar, CheckCircle2, Sparkles, Wrench } from 'lucide-react';
import { Modal } from './Modal';
import {
  APP_BUILD_ID,
  APP_UPDATE_FEATURES,
  APP_UPDATE_FIXES,
  APP_UPDATE_PUBLISHED_AT,
  APP_VERSION_LABEL,
} from '../lib/appUpdate';

interface ReleaseNotesModalProps {
  open: boolean;
  onClose: () => void;
}

export const RELEASE_NOTES_VERSION = APP_VERSION_LABEL;
export const RELEASE_NOTES_PUBLISHED_AT = APP_UPDATE_PUBLISHED_AT;

function formatPublishedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Latest release';
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function ReleaseList({ items, type }: { items: string[]; type: 'feature' | 'fix' }) {
  const Icon = type === 'feature' ? Sparkles : Wrench;
  const tone = type === 'feature'
    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/[0.10] dark:text-emerald-300'
    : 'bg-amber-50 text-amber-600 dark:bg-amber-500/[0.10] dark:text-amber-300';

  return (
    <ul className="space-y-2.5">
      {items.map(item => (
        <li key={item} className="flex items-start gap-3 rounded-2xl border border-gray-200/70 bg-white/70 p-3.5 dark:border-white/[0.06] dark:bg-white/[0.025]">
          <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${tone}`}>
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="text-[13px] leading-relaxed text-gray-600 dark:text-white/60">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function ReleaseNotesModal({ open, onClose }: ReleaseNotesModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="What’s new" size="lg" mobileView="dialog">
      <div className="space-y-5">
        <div className="relative overflow-hidden rounded-3xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-5 dark:border-emerald-400/15 dark:from-emerald-500/[0.11] dark:via-white/[0.025] dark:to-sky-500/[0.07] sm:p-6">
          <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-emerald-300/20 blur-3xl dark:bg-emerald-400/10" />
          <div className="relative flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-[0_12px_30px_-12px_rgba(16,185,129,0.75)]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300/80">ServeSync {APP_VERSION_LABEL}</p>
              <h2 className="mt-1 text-[20px] font-black tracking-[-0.035em] text-gray-950 dark:text-white sm:text-[23px]">A smoother start, every time.</h2>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500 dark:text-white/40">
                <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{formatPublishedDate(APP_UPDATE_PUBLISHED_AT)}</span>
                <span className="font-mono">Build {APP_BUILD_ID}</span>
              </div>
            </div>
          </div>
        </div>

        <section aria-labelledby="release-features-title">
          <h3 id="release-features-title" className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-700 dark:text-white/65">
            <Sparkles className="h-4 w-4 text-emerald-500" /> New in this version
          </h3>
          <ReleaseList items={APP_UPDATE_FEATURES} type="feature" />
        </section>

        <section aria-labelledby="release-fixes-title">
          <h3 id="release-fixes-title" className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-700 dark:text-white/65">
            <Wrench className="h-4 w-4 text-amber-500" /> Improvements
          </h3>
          <ReleaseList items={APP_UPDATE_FIXES} type="fix" />
        </section>

        <button
          type="button"
          onClick={onClose}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-emerald-500 text-[13px] font-bold text-white transition-colors hover:bg-emerald-600 active:scale-[0.99]"
        >
          <CheckCircle2 className="h-4 w-4" /> Got it
        </button>
      </div>
    </Modal>
  );
}

import { useEffect, useState } from 'react';
import { ArrowDown, BellRing, CheckCircle2, Sparkles, X } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { PushNotificationSetting } from '../components/PushNotificationSetting';

export function PushNotificationSettings() {
  const [searchParams] = useSearchParams();
  const [showSetupGuide, setShowSetupGuide] = useState(() => searchParams.get('setup') === 'push');
  const [setupComplete, setSetupComplete] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    setShowSetupGuide(searchParams.get('setup') === 'push');
    setSetupComplete(false);
  }, [searchParams]);

  return (
    <div className="page-container page-bottom-pad relative isolate">
      {showSetupGuide && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 bg-black/58 backdrop-blur-[2px]"
        />
      )}

      <div className="app-content-shell relative z-10 mx-auto max-w-2xl space-y-5 pt-4 sm:pt-5">
        <div className="rounded-3xl border border-gray-200/80 bg-white p-5 shadow-sm dark:border-white/[0.07] dark:bg-white/[0.025] sm:p-7">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
              <BellRing className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-300">Settings</p>
              <h1 className="mt-1 text-2xl font-black tracking-[-0.03em] text-gray-950 dark:text-white">Notifications</h1>
              <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-white/60">Choose how ServeSync can reach this device.</p>
            </div>
          </div>
        </div>

        <section
          id="push-notification-setting"
          className={`relative rounded-3xl border border-gray-200/80 bg-white p-5 shadow-sm dark:border-white/[0.07] dark:bg-white/[0.025] sm:p-6 ${
            showSetupGuide ? 'ring-2 ring-emerald-400/80 ring-offset-4 ring-offset-[#111013] shadow-[0_0_50px_-18px_rgba(52,211,153,0.95)]' : ''
          }`}
        >
          {showSetupGuide && (
            <motion.div
              role="status"
              initial={prefersReducedMotion ? false : { opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 360, damping: 24 }}
              className="absolute inset-x-3 -top-[4.9rem] z-20 flex items-center gap-2 rounded-2xl border border-emerald-300/35 bg-[#123327] px-3 py-2.5 text-left text-emerald-50 shadow-xl shadow-black/35 sm:inset-x-6"
            >
              <Sparkles className="h-4 w-4 shrink-0 text-emerald-300" />
              <p className="min-w-0 flex-1 text-[12px] font-bold leading-4">Enable Push Notifications here to receive assignments, reminders, and team updates.</p>
              <button
                type="button"
                onClick={() => setShowSetupGuide(false)}
                className="-mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-emerald-100/70 transition hover:bg-white/10 hover:text-white"
                aria-label="Dismiss notification setup guide"
              >
                <X className="h-4 w-4" />
              </button>
              <ArrowDown className="absolute -bottom-4 left-1/2 h-5 w-5 -translate-x-1/2 text-emerald-300" fill="#123327" />
            </motion.div>
          )}
          <PushNotificationSetting
            onEnabled={() => {
              setShowSetupGuide(false);
              setSetupComplete(true);
            }}
          />
        </section>

        {setupComplete && (
          <motion.section
            role="status"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 340, damping: 25 }}
            className="flex items-start gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.10] px-4 py-3.5 text-emerald-950 shadow-sm dark:text-emerald-50"
          >
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" aria-hidden="true" />
            <div>
              <p className="text-sm font-extrabold">You’re all set.</p>
              <p className="mt-1 text-sm leading-5 text-emerald-800/80 dark:text-emerald-100/75">Notifications are enabled for this device. You can now receive assignments, reminders, and team updates.</p>
            </div>
          </motion.section>
        )}
      </div>
    </div>
  );
}

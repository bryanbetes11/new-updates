import { ArrowLeft, Megaphone } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AnnouncementComposerForm } from '../components/AnnouncementComposerForm';
import { useSmartBack } from '../lib/navigationHistory';

export function AnnouncementCreate() {
  const navigate = useNavigate();
  const smartBack = useSmartBack('/announcements');

  return (
    <div className="page-container page-bottom-pad overflow-hidden">
      <div className="mx-auto max-w-2xl space-y-5 px-4 pt-4 sm:max-w-6xl sm:space-y-6 sm:px-6 sm:pt-5 lg:max-w-6xl lg:px-8 xl:max-w-[1560px]">
        <motion.section
          initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-[2rem] border border-amber-200/70 bg-[radial-gradient(circle_at_18%_20%,rgba(251,191,36,0.24),transparent_34%),radial-gradient(circle_at_86%_24%,rgba(251,191,36,0.16),transparent_36%),linear-gradient(135deg,#fffaf0_0%,#ffffff_48%,#f8fafc_100%)] p-5 shadow-[0_24px_80px_-46px_rgba(146,64,14,0.65)] dark:border-white/[0.08] dark:bg-[radial-gradient(circle_at_16%_18%,rgba(245,158,11,0.18),transparent_34%),radial-gradient(circle_at_86%_24%,rgba(245,158,11,0.12),transparent_36%),linear-gradient(135deg,#1c1307_0%,#10100d_46%,#070807_100%)] sm:p-6"
        >
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <button
                type="button"
                onClick={smartBack}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-amber-700 shadow-sm ring-1 ring-black/[0.04] transition-colors hover:bg-white dark:bg-white/[0.06] dark:text-amber-300 dark:ring-white/[0.06] dark:hover:bg-white/[0.1]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
              <div className="mt-4 flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.35rem] bg-[linear-gradient(135deg,#f59e0b,#d97706)] text-white shadow-[0_18px_38px_-24px_rgba(217,119,6,0.95)]">
                  <Megaphone className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-mono font-black uppercase tracking-[0.32em] text-amber-700/75 dark:text-amber-300/70">
                    Team updates
                  </p>
                  <h1
                    className="mt-1 text-[2.3rem] font-black leading-none text-gray-950 dark:text-white sm:text-[3rem]"
                    style={{ letterSpacing: '-0.065em' }}
                  >
                    Creating Announcement
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-white/52">
                    Write the update once, add photos if needed, and send it to the team from a cleaner full-page flow on mobile.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.45, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-[2rem] border border-black/[0.05] bg-white/90 p-5 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.32)] dark:border-white/[0.07] dark:bg-white/[0.035] sm:p-6"
        >
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.06] to-transparent dark:via-white/[0.1]" />
          <AnnouncementComposerForm
            cancelLabel="Back"
            onCancel={smartBack}
            onSuccess={() => navigate('/announcements')}
          />
        </motion.section>
      </div>
    </div>
  );
}

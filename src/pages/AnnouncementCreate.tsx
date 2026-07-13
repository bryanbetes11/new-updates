import { ArrowLeft, Megaphone } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AnnouncementComposerForm } from '../components/AnnouncementComposerForm';
import { useSmartBack } from '../lib/navigationHistory';

export function AnnouncementCreate() {
  const navigate = useNavigate();
  const smartBack = useSmartBack('/announcements');

  return (
    <div className="page-container page-bottom-pad relative min-h-screen overflow-hidden bg-[#050505] text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[#050505] [background-image:radial-gradient(circle_at_18%_0%,rgba(34,197,94,0.12),transparent_28%),radial-gradient(circle_at_88%_6%,rgba(255,255,255,0.05),transparent_20%),linear-gradient(180deg,#121212_0%,#050505_26%,#050505_100%)]" />
      <div className="mx-auto max-w-2xl space-y-5 px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-4 sm:max-w-3xl sm:space-y-6 sm:px-6 sm:pt-5 lg:max-w-4xl lg:px-8 lg:pb-24 xl:max-w-5xl">
        <motion.section
          initial={{ opacity: 0, y: 10, filter: 'blur(5px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-5 border-b border-white/[0.08] pb-5"
        >
          <button
            type="button"
            onClick={smartBack}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-white/[0.075] px-4 text-[11px] font-black uppercase tracking-[0.13em] text-white/70 transition-colors hover:bg-white/[0.11] hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <div className="flex items-center gap-3">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[0.6rem] bg-gradient-to-br from-emerald-400 via-green-800 to-black text-[#22c55e] shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
              <span className="absolute h-12 w-12 bg-[radial-gradient(circle_at_28%_22%,rgba(255,255,255,0.34),transparent_32%)]" />
              <Megaphone className="relative h-5 w-5 text-white/90" strokeWidth={2.3} />
            </div>
            <div className="min-w-0">
              <h1
                className="text-[2.15rem] font-black leading-none text-white sm:text-[3rem]"
              >
                New update
              </h1>
              <p className="mt-1 max-w-2xl text-[13px] font-semibold leading-5 text-white/45 sm:text-sm">
                Post a team announcement with mentions and photos.
              </p>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.45, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-[0.85rem] border border-white/[0.08] bg-[#181818] p-4 shadow-[0_22px_60px_-46px_rgba(0,0,0,0.95)] sm:p-5"
        >
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.10] to-transparent" />
          <AnnouncementComposerForm
            variant="spotify"
            cancelLabel="Back"
            onCancel={smartBack}
            onSuccess={() => navigate('/announcements')}
          />
        </motion.section>
      </div>
    </div>
  );
}

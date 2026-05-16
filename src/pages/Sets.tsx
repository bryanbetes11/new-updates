import { ListMusic } from 'lucide-react';
import { motion } from 'framer-motion';
import { SetlistsTab } from './library/SetlistsTab';

export function Sets() {
  return (
    <div className="page-container page-bottom-pad overflow-hidden">
      <div className="max-w-2xl lg:max-w-5xl xl:max-w-7xl 2xl:max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-5 sm:space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-[2rem] border border-emerald-200/70 bg-[radial-gradient(circle_at_18%_20%,rgba(52,211,153,0.22),transparent_34%),radial-gradient(circle_at_86%_24%,rgba(52,211,153,0.15),transparent_36%),linear-gradient(135deg,#f0fdf4_0%,#ffffff_48%,#f8fafc_100%)] p-5 shadow-[0_24px_80px_-46px_rgba(6,95,70,0.72)] dark:border-white/[0.08] dark:bg-[radial-gradient(circle_at_16%_18%,rgba(16,185,129,0.17),transparent_34%),radial-gradient(circle_at_86%_24%,rgba(16,185,129,0.11),transparent_36%),linear-gradient(135deg,#071c14_0%,#0d1110_46%,#070807_100%)] sm:p-6"
        >
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/[0.09]" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-70 animate-ping dark:bg-emerald-400" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                </span>
                <p className="text-[10px] font-mono font-black uppercase tracking-[0.32em] text-emerald-700/75 dark:text-emerald-300/70">
                  Sets <span className="mx-1.5 text-emerald-700/25 dark:text-white/20">·</span> Past events
                </p>
              </div>
              <h1
                className="mt-3 text-[2.35rem] font-black leading-none text-gray-950 dark:text-white sm:text-[3.15rem] lg:text-[3.65rem]"
                style={{ letterSpacing: '-0.065em' }}
              >
                Sets.
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-white/52">
                Browse approved worship sets from past events and imported set histories.
              </p>
            </div>

            <div className="rounded-2xl border border-white bg-white px-4 py-4 text-center shadow-sm dark:border-white/[0.08] dark:bg-white/[0.05] sm:min-w-[12rem]">
              <ListMusic className="mx-auto h-5 w-5 text-emerald-600 dark:text-emerald-300" />
              <p className="mt-2 text-lg font-black leading-none text-gray-950 dark:text-white">Past Sets</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-white/32">Approved</p>
            </div>
          </div>
        </motion.section>

        <SetlistsTab fixedView="setlists" />
      </div>
    </div>
  );
}

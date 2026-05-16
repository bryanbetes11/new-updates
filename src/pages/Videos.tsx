import { Film, Video } from 'lucide-react';
import { motion } from 'framer-motion';
import { VideosTab } from './library/VideosTab';

export function Videos() {
  return (
    <div className="page-container page-bottom-pad overflow-hidden">
      <div className="max-w-2xl lg:max-w-5xl xl:max-w-7xl 2xl:max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-5 sm:space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-[2rem] border border-sky-200/70 bg-[radial-gradient(circle_at_18%_20%,rgba(56,189,248,0.2),transparent_34%),radial-gradient(circle_at_86%_24%,rgba(16,185,129,0.12),transparent_36%),linear-gradient(135deg,#f0f9ff_0%,#ffffff_48%,#f8fafc_100%)] p-5 shadow-[0_24px_80px_-46px_rgba(3,105,161,0.55)] dark:border-white/[0.08] dark:bg-[radial-gradient(circle_at_16%_18%,rgba(56,189,248,0.14),transparent_34%),radial-gradient(circle_at_86%_24%,rgba(16,185,129,0.1),transparent_36%),linear-gradient(135deg,#071821_0%,#0d1110_46%,#070807_100%)] sm:p-6"
        >
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/[0.09]" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-sky-500 opacity-70 animate-ping dark:bg-sky-400" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-500 dark:bg-sky-400" />
                </span>
                <p className="text-[10px] font-mono font-black uppercase tracking-[0.32em] text-sky-700/75 dark:text-sky-300/70">
                  Videos <span className="mx-1.5 text-sky-700/25 dark:text-white/20">·</span> Media library
                </p>
              </div>
              <h1
                className="mt-3 text-[2.35rem] font-black leading-none text-gray-950 dark:text-white sm:text-[3.15rem] lg:text-[3.65rem]"
                style={{ letterSpacing: '-0.065em' }}
              >
                Videos.
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-white/52">
                Keep training videos, references, and worship resources separate from the song chart library.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:min-w-[18rem]">
              <div className="rounded-2xl border border-white bg-white px-3 py-3 text-center shadow-sm dark:border-white/[0.08] dark:bg-white/[0.05]">
                <Video className="mx-auto h-4 w-4 text-sky-600 dark:text-sky-300" />
                <p className="mt-1 text-lg font-black leading-none text-gray-950 dark:text-white">Videos</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-white/32">Library</p>
              </div>
              <div className="rounded-2xl border border-white bg-white px-3 py-3 text-center shadow-sm dark:border-white/[0.08] dark:bg-white/[0.05]">
                <Film className="mx-auto h-4 w-4 text-sky-600 dark:text-sky-300" />
                <p className="mt-1 text-lg font-black leading-none text-gray-950 dark:text-white">Media</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-white/32">Resources</p>
              </div>
            </div>
          </div>
        </motion.section>

        <VideosTab />
      </div>
    </div>
  );
}

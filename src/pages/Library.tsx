import { useState } from 'react';
import { BookOpen, Video } from 'lucide-react';
import { motion } from 'framer-motion';
import { VideosTab } from './library/VideosTab';
import { SetlistsTab } from './library/SetlistsTab';

type Tab = 'songs' | 'videos';

const tabs: { id: Tab; label: string; shortLabel: string; icon: React.ElementType }[] = [
  { id: 'songs', label: 'Songs', shortLabel: 'Songs', icon: BookOpen },
  { id: 'videos', label: 'Videos', shortLabel: 'Videos', icon: Video },
];

export function Library() {
  const [tab, setTab] = useState<Tab>('songs');

  return (
    <div className="page-container page-bottom-pad overflow-hidden">
      <div className="max-w-2xl lg:max-w-5xl xl:max-w-7xl 2xl:max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-5 sm:space-y-6">

        {/* ── Library Command Center ───────────────────── */}
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
                  Resources <span className="mx-1.5 text-emerald-700/25 dark:text-white/20">·</span> Team library
                </p>
              </div>
              <h1
                className="mt-3 text-[2.35rem] font-black leading-none text-gray-950 dark:text-white sm:text-[3.15rem] lg:text-[3.65rem]"
                style={{ letterSpacing: '-0.065em' }}
              >
                Library.
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-white/52">
                Keep songs, chord charts, and ministry videos organized and ready for rehearsal.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:min-w-[18rem]">
              {[
                { label: 'Songs', value: 'Ready', icon: BookOpen },
                { label: 'Videos', value: 'Ready', icon: Video },
              ].map(stat => (
                <button
                  key={stat.label}
                  onClick={() => setTab(stat.label === 'Songs' ? 'songs' : 'videos')}
                  className="rounded-2xl border border-white bg-white px-3 py-3 text-center shadow-sm transition-all hover:-translate-y-0.5 active:scale-[0.98] dark:border-white/[0.08] dark:bg-white/[0.05] dark:hover:bg-white/[0.075]"
                >
                  <stat.icon className="mx-auto h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                  <p className="mt-1 text-lg font-black leading-none text-gray-950 dark:text-white">{stat.value}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-white/32">{stat.label}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="relative mt-5 border-t border-emerald-900/[0.07] pt-4 dark:border-white/[0.11]">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700/70 dark:text-emerald-300/80">Now viewing</p>
            <p className="mt-1 text-sm font-extrabold text-gray-800 dark:text-white">
              {tab === 'songs' ? 'Songs and chord charts' : 'Training and reference videos'}
              <span className="font-mono text-xs font-semibold text-gray-400 dark:text-emerald-100/55"> · {tab === 'songs' ? 'Music library' : 'Media resources'}</span>
            </p>
          </div>
        </motion.section>

        {/* ── Toolbar ────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-[1.6rem] border border-black/[0.05] bg-white/75 p-2 shadow-[0_16px_44px_-34px_rgba(15,23,42,0.65)] backdrop-blur-xl dark:border-white/[0.07] dark:bg-white/[0.035]"
        >
          <div className="flex gap-1 rounded-[1.25rem] bg-gray-100/80 p-1 dark:bg-black/20">
            {tabs.map(t => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl transition-all duration-200 ${
                    active
                      ? 'bg-white text-gray-950 shadow-sm ring-1 ring-black/[0.04] dark:bg-white/[0.09] dark:text-white dark:ring-white/[0.08]'
                      : 'text-gray-400 hover:bg-white/55 hover:text-gray-700 dark:text-white/35 dark:hover:bg-white/[0.045] dark:hover:text-white/70'
                  }`}
                >
                  <t.icon
                    className={`h-4 w-4 transition-colors ${
                      active ? 'text-emerald-600 dark:text-emerald-300' : 'text-gray-400 dark:text-white/35'
                    }`}
                  />
                  <span className="text-[12px] font-black leading-none">{t.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* ── Tab Content ──────────────────────────────── */}
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8, filter: 'blur(3px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          {tab === 'songs' ? (
            <SetlistsTab fixedView="songs" />
          ) : (
            <VideosTab />
          )}
        </motion.div>

      </div>
    </div>
  );
}

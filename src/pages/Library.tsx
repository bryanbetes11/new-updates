import { useState } from 'react';
import { BookOpen, ListMusic, Video } from 'lucide-react';
import { motion } from 'framer-motion';
import { VideosTab } from './library/VideosTab';
import { SetlistsTab } from './library/SetlistsTab';

type Tab = 'setlists' | 'videos';

const tabs: { id: Tab; label: string; shortLabel: string; icon: React.ElementType }[] = [
  { id: 'setlists', label: 'Setlists', shortLabel: 'Setlists', icon: ListMusic },
  { id: 'videos', label: 'Videos', shortLabel: 'Videos', icon: Video },
];

export function Library() {
  const [tab, setTab] = useState<Tab>('setlists');

  return (
    <div className="page-container page-bottom-pad">
      <div className="max-w-2xl lg:max-w-5xl xl:max-w-7xl 2xl:max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-5 sm:space-y-6">

        {/* ── Header ───────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-3.5"
        >
          <div className="relative shrink-0">
            <div
              className="absolute inset-0 rounded-2xl"
              style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.35), transparent 70%)', filter: 'blur(10px)', transform: 'scale(1.5)' }}
            />
            <div
              className="relative h-11 w-11 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(145deg, #16a34a, #15803d)', boxShadow: '0 4px 14px rgba(22,163,74,0.35)' }}
            >
              <BookOpen className="h-5 w-5 text-white" />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-mono font-medium uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400/80 mb-0.5">
              Resources
            </p>
            <h1 className="text-[1.5rem] sm:text-[1.75rem] font-black text-gray-900 dark:text-white leading-tight" style={{ letterSpacing: '-0.03em' }}>
              Library.
            </h1>
          </div>
        </motion.div>

        {/* ── Tab Strip ────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="flex gap-1 p-1 rounded-2xl"
          style={{
            background: 'rgba(0,0,0,0.04)',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)',
          }}
        >
          {tabs.map(t => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all duration-200 ${
                  active
                    ? 'bg-white dark:bg-white/[0.06] shadow-sm ring-1 ring-black/[0.06] dark:ring-white/[0.09]'
                    : 'hover:bg-white/50 dark:hover:bg-white/[0.04]'
                }`}
              >
                <t.icon
                  className={`h-4 w-4 transition-colors ${
                    active ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'
                  }`}
                />
                <span
                  className={`text-[12px] font-bold transition-colors leading-none ${
                    active ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {t.shortLabel}
                </span>
                {active && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute inset-0 rounded-xl"
                    style={{ background: 'transparent' }}
                    transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                  />
                )}
              </button>
            );
          })}
        </motion.div>

        {/* ── Tab Content ──────────────────────────────── */}
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8, filter: 'blur(3px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          {tab === 'setlists' ? (
            <SetlistsTab initialView="setlists" />
          ) : (
            <VideosTab />
          )}
        </motion.div>

      </div>
    </div>
  );
}

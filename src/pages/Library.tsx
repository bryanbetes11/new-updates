import { useState } from 'react';
import type { ElementType } from 'react';
import { BookOpen, ListChecks } from 'lucide-react';
import { motion } from 'framer-motion';
import { SetlistsTab } from './library/SetlistsTab';

type Tab = 'songs' | 'sets';

const tabs: { id: Tab; label: string; shortLabel: string; icon: ElementType }[] = [
  { id: 'songs', label: 'Songs', shortLabel: 'Songs', icon: BookOpen },
  { id: 'sets', label: 'Sets', shortLabel: 'Sets', icon: ListChecks },
];

export function Library() {
  const [tab, setTab] = useState<Tab>('songs');

  return (
    <div className="page-container page-bottom-pad overflow-hidden">
      <div className="max-w-2xl lg:max-w-5xl xl:max-w-7xl 2xl:max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-5 sm:space-y-6">

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
            <SetlistsTab fixedView="setlists" />
          )}
        </motion.div>

      </div>
    </div>
  );
}

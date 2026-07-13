import { useRef, useState, type ElementType, type KeyboardEvent } from 'react';
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
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({
    songs: null,
    sets: null,
  });

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentTab: Tab) => {
    const currentIndex = tabs.findIndex(item => item.id === currentTab);
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = tabs.length - 1;
    }

    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = tabs[nextIndex].id;
    setTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  };

  return (
    <div className="page-container page-bottom-pad overflow-x-clip">
      <div className="mx-auto max-w-2xl space-y-5 px-4 pt-4 sm:max-w-3xl sm:px-6 sm:pt-6 lg:max-w-5xl lg:px-8 xl:max-w-7xl 2xl:max-w-[1680px]">
        <h1 className="sr-only">Library</h1>

        {/* ── Toolbar ────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-[1.6rem] border border-black/[0.05] bg-white/75 p-2 shadow-[0_16px_44px_-34px_rgba(15,23,42,0.65)] backdrop-blur-xl dark:border-white/[0.07] dark:bg-white/[0.035]"
        >
          <div
            className="flex gap-1 rounded-[1.25rem] bg-gray-100/80 p-1 dark:bg-black/20"
            role="tablist"
            aria-label="Library views"
          >
            {tabs.map(t => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  ref={element => {
                    tabRefs.current[t.id] = element;
                  }}
                  type="button"
                  id={`library-tab-${t.id}`}
                  role="tab"
                  aria-selected={active}
                  aria-controls="library-panel"
                  tabIndex={active ? 0 : -1}
                  onClick={() => setTab(t.id)}
                  onKeyDown={event => handleTabKeyDown(event, t.id)}
                  className={`relative flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-2.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${
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
          id="library-panel"
          role="tabpanel"
          aria-labelledby={`library-tab-${tab}`}
          tabIndex={0}
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

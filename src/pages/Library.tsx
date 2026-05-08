import { useState } from 'react';
import { BookOpen, ListMusic, Video, BarChart2 } from 'lucide-react';
import { VideosTab } from './library/VideosTab';
import { SetlistsTab } from './library/SetlistsTab';

type Tab = 'setlists' | 'videos' | 'tracker';

const tabs: { id: Tab; label: string; shortLabel: string; icon: React.ElementType; desc: string }[] = [
  { id: 'setlists', label: 'Setlists', shortLabel: 'Setlists', icon: ListMusic, desc: 'Past & approved' },
  { id: 'tracker', label: 'Song Tracker', shortLabel: 'Tracker', icon: BarChart2, desc: '90-day rotation' },
  { id: 'videos', label: 'Videos', shortLabel: 'Videos', icon: Video, desc: 'Team resources' },
];

export function Library() {
  const [tab, setTab] = useState<Tab>('setlists');

  return (
    <div className="page-container page-bottom-pad">

      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="px-4 sm:px-5 lg:px-6 pt-5 sm:pt-7 pb-0">
        <div className="flex items-start justify-between gap-3 mb-5 animate-fade-in" style={{ animationFillMode: 'both' }}>
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center h-11 w-11 rounded-2xl shrink-0"
              style={{
                background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                boxShadow: '0 3px 12px rgba(22,163,74,0.3)',
              }}
            >
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1
                className="text-[1.375rem] font-black text-gray-900 dark:text-white leading-tight"
                style={{ letterSpacing: '-0.03em' }}
              >
                Library
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Setlists · Song tracker · Team videos
              </p>
            </div>
          </div>
        </div>

        {/* ── Tab Navigation ──────────────────────────────────── */}
        <div
          className="flex gap-1 p-1 rounded-2xl animate-slide-up"
          style={{
            animationDelay: '50ms',
            animationFillMode: 'both',
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
                className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 rounded-xl transition-all duration-200 ${
                  active
                    ? 'bg-white dark:bg-[#232325] shadow-sm ring-1 ring-black/[0.06] dark:ring-white/[0.09]'
                    : 'hover:bg-white/50 dark:hover:bg-white/[0.04]'
                }`}
              >
                <t.icon
                  className={`h-4 w-4 transition-colors ${
                    active ? 'text-brand-600 dark:text-brand-400' : 'text-gray-400 dark:text-gray-500'
                  }`}
                />
                <span
                  className={`text-[11px] font-bold transition-colors leading-none ${
                    active ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {t.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab Content ─────────────────────────────────────── */}
      <div className="px-4 sm:px-5 lg:px-6 pt-4">
        <div key={tab} className="animate-slide-up" style={{ animationDuration: '160ms', animationFillMode: 'both' }}>
          {tab === 'setlists' ? (
            <SetlistsTab initialView="setlists" />
          ) : tab === 'tracker' ? (
            <SetlistsTab initialView="songs" />
          ) : (
            <VideosTab />
          )}
        </div>
      </div>
    </div>
  );
}

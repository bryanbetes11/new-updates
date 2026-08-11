import { useState } from 'react';
import { ClipboardCheck, Shield } from 'lucide-react';
import { AttendanceMonitoring } from '../components/AttendanceMonitoring';
import { LeadershipHeroCard } from '../components/LeadershipHeroCard';
import { Discipline } from './Discipline';

export function Accountability() {
  const [activeTab, setActiveTab] = useState<'attendance' | 'conduct'>(() => {
    return new URLSearchParams(window.location.search).get('tab') === 'conduct' ? 'conduct' : 'attendance';
  });

  return (
    <div className="page-container page-bottom-pad">
      <div className="relative mx-auto max-w-2xl px-4 pb-6 pt-4 sm:px-6 sm:pt-5 lg:max-w-6xl lg:px-8 xl:max-w-[1560px]">
        <div className="space-y-5 sm:space-y-6">
          <LeadershipHeroCard
            tone="amber"
            icon={ClipboardCheck}
            eyebrow="Attendance & Conduct"
            title="Accountability."
            description="Review quarterly attendance, identify policy thresholds, and manage conduct follow-up from one leadership workspace."
          />

          <div className="grid grid-cols-2 gap-1 rounded-2xl border border-gray-200 bg-gray-100/80 p-1 dark:border-white/[0.08] dark:bg-white/[0.035]" role="tablist" aria-label="Accountability views">
            {(['attendance', 'conduct'] as const).map(tab => {
              const isActive = activeTab === tab;
              const Icon = tab === 'attendance' ? ClipboardCheck : Shield;
              const label = tab === 'attendance' ? 'Attendance' : 'Conduct';
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab)}
                  className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition-all ${isActive ? 'bg-white text-gray-900 shadow-sm dark:bg-white/[0.08] dark:text-white' : 'text-gray-500 hover:text-gray-800 dark:text-white/45 dark:hover:text-white/75'}`}
                >
                  <Icon className={`h-4 w-4 ${tab === 'attendance' ? 'text-emerald-500' : 'text-rose-500'}`} />
                  {label}
                </button>
              );
            })}
          </div>

          {activeTab === 'attendance' ? (
            <section aria-label="Attendance accountability"><AttendanceMonitoring /></section>
          ) : (
            <section aria-label="Conduct accountability"><Discipline embedded /></section>
          )}
        </div>
      </div>
    </div>
  );
}

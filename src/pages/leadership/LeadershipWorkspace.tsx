import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, LayoutDashboard, Users, CalendarCheck, AlertTriangle, ListMusic, Building2, CreditCard, ArrowLeftRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useUnreadCounts } from '../../hooks/useUnreadCounts';
import { LeaderDashboard } from '../LeaderDashboard';
import { TeamManage } from '../TeamManage';
import { Requests } from '../Requests';
import { Discipline } from '../Discipline';
import { SetlistDeadlines } from './SetlistDeadlines';
import { OrganizationSettings } from './OrganizationSettings';
import { OrganizationBilling } from './OrganizationBilling';
import { SwapRequests } from '../SwapRequests';

type Tab = 'overview' | 'team' | 'leave' | 'swaps' | 'discipline' | 'setlists' | 'church' | 'billing';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.42, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

interface TabConfig {
  id: Tab;
  label: string;
  icon: React.ElementType;
  show: boolean;
}

export function LeadershipWorkspace() {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const { isLeader, canApproveLeave, canManageDiscipline, isOrgAdmin } = useAuth();
  const unread = useUnreadCounts();

  const tabs: TabConfig[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, show: isLeader },
    { id: 'setlists', label: 'Approve Setlist', icon: ListMusic, show: isLeader },
    { id: 'leave', label: 'Leave', icon: CalendarCheck, show: !!canApproveLeave },
    { id: 'swaps', label: 'Swaps', icon: ArrowLeftRight, show: isLeader },
    { id: 'discipline', label: 'Conduct', icon: AlertTriangle, show: isLeader || !!canManageDiscipline },
    { id: 'team', label: 'Team', icon: Users, show: isLeader || isOrgAdmin },
    { id: 'church', label: 'Church', icon: Building2, show: isOrgAdmin },
    { id: 'billing', label: 'Billing', icon: CreditCard, show: isOrgAdmin },
  ];

  const visibleTabs = tabs.filter(t => t.show);
  const defaultTab = visibleTabs[0]?.id ?? 'overview';

  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const stored = localStorage.getItem('leadershipActiveTab') as Tab | null;
    if (tab && visibleTabs.find(t => t.id === tab)) return tab as Tab;
    if (stored && visibleTabs.find(t => t.id === stored)) return stored;
    return defaultTab;
  });

  useEffect(() => {
    localStorage.setItem('leadershipActiveTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!tab || !visibleTabs.find(t => t.id === tab)) {
      navigate(`/leadership/${activeTab}`, { replace: true });
    }
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isLeader && !canApproveLeave && !canManageDiscipline && !isOrgAdmin) {
    return (
      <div className="page-container page-bottom-pad flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div
            className="relative h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(145deg, #94a3b8, #64748b)', boxShadow: '0 4px 14px rgba(100,116,139,0.25)' }}
          >
            <Shield className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white" style={{ letterSpacing: '-0.02em' }}>Access Restricted</h2>
          <p className="text-sm text-gray-500 dark:text-white/45 mt-1">Leadership access required.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container page-bottom-pad overflow-hidden">
      <div className="max-w-2xl lg:max-w-5xl xl:max-w-7xl 2xl:max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-5 sm:space-y-6">

        {/* ── Leader Command Center ────────────────────── */}
        <motion.section
          {...fadeUp(0)}
          className="relative overflow-hidden rounded-[2rem] border border-emerald-200/70 bg-[radial-gradient(circle_at_18%_20%,rgba(52,211,153,0.24),transparent_34%),radial-gradient(circle_at_86%_24%,rgba(52,211,153,0.16),transparent_36%),linear-gradient(135deg,#f0fdf4_0%,#ffffff_48%,#f8fafc_100%)] p-5 shadow-[0_24px_80px_-46px_rgba(6,95,70,0.72)] dark:border-white/[0.08] dark:bg-[radial-gradient(circle_at_16%_18%,rgba(16,185,129,0.18),transparent_34%),radial-gradient(circle_at_86%_24%,rgba(16,185,129,0.12),transparent_36%),linear-gradient(135deg,#071c14_0%,#0d1110_46%,#070807_100%)] sm:p-6"
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
                  Admin workspace <span className="mx-1.5 text-emerald-700/25 dark:text-white/20">·</span> Team care
                </p>
              </div>
              <h1
                className="mt-3 text-[2.35rem] font-black leading-none text-gray-950 dark:text-white sm:text-[3.15rem] lg:text-[3.65rem]"
                style={{ letterSpacing: '-0.065em' }}
              >
                Leader.
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-white/52">
                Review schedules, people, requests, and ministry health from one calm control room.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:min-w-[23rem]">
              {[
                { label: 'Tools', value: visibleTabs.length },
                { label: 'Leave', value: unread.pendingLeave || 0 },
                { label: 'Swaps', value: unread.pendingSwaps || 0 },
              ].map(stat => (
                <div key={stat.label} className="rounded-2xl border border-white bg-white px-3 py-3 text-center shadow-sm dark:border-white/[0.08] dark:bg-white/[0.05]">
                  <p className="text-lg font-black leading-none text-gray-950 dark:text-white">{stat.value}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-white/32">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mt-5 border-t border-emerald-900/[0.07] pt-4 dark:border-white/[0.11]">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700/70 dark:text-emerald-300/80">Current workspace</p>
            <p className="mt-1 truncate text-sm font-extrabold text-gray-800 dark:text-white">
              {visibleTabs.find(t => t.id === activeTab)?.label || 'Overview'}
              <span className="font-mono text-xs font-semibold text-gray-400 dark:text-emerald-100/55"> · {visibleTabs.length} tools available</span>
            </p>
          </div>
        </motion.section>

        {/* ── Tool Switcher ────────────────────────────── */}
        <motion.div
          {...fadeUp(0.05)}
          className="rounded-[1.6rem] border border-black/[0.05] bg-white/75 p-2 shadow-[0_16px_44px_-34px_rgba(15,23,42,0.65)] backdrop-blur-xl dark:border-white/[0.07] dark:bg-white/[0.035]"
        >
          <div className="flex gap-1 overflow-x-auto rounded-[1.25rem] bg-gray-100/80 p-1 dark:bg-black/20 no-scrollbar">
            {visibleTabs.map(t => {
              const isActive = activeTab === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`relative flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl px-3 py-2.5 transition-all sm:px-4 ${
                    isActive
                      ? 'bg-white text-gray-950 shadow-sm ring-1 ring-black/[0.04] dark:bg-white/[0.09] dark:text-white dark:ring-white/[0.08]'
                      : 'text-gray-400 hover:bg-white/55 hover:text-gray-700 dark:text-white/35 dark:hover:bg-white/[0.045] dark:hover:text-white/70'
                  }`}
                >
                  <Icon className={`relative z-10 h-3.5 w-3.5 shrink-0 transition-colors duration-200 ${isActive ? 'text-emerald-600 dark:text-emerald-300' : 'text-gray-400 dark:text-white/35'}`} />
                  <span className="relative z-10 text-[12px] sm:text-[13px] font-black leading-none">
                    {t.label}
                  </span>
                  {t.id === 'leave' && unread.pendingLeave > 0 && (
                    <span className="relative z-10 flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none" style={{ boxShadow: '0 0 8px rgba(239,68,68,0.5)' }}>
                      {unread.pendingLeave > 9 ? '9+' : unread.pendingLeave}
                    </span>
                  )}
                  {t.id === 'swaps' && unread.pendingSwaps > 0 && (
                    <span className="relative z-10 flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none" style={{ boxShadow: '0 0 8px rgba(239,68,68,0.5)' }}>
                      {unread.pendingSwaps > 9 ? '9+' : unread.pendingSwaps}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* ── Tab Content ──────────────────────────────── */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {activeTab === 'overview' && <OverviewWrapper />}
            {activeTab === 'team' && <TeamWrapper />}
            {activeTab === 'leave' && <LeaveWrapper />}
            {activeTab === 'swaps' && <SwapRequests embedded />}
            {activeTab === 'discipline' && <DisciplineWrapper />}
            {activeTab === 'setlists' && <SetlistDeadlines />}
            {activeTab === 'church' && <OrganizationSettings />}
            {activeTab === 'billing' && <OrganizationBilling />}
          </motion.div>
        </AnimatePresence>

      </div>
    </div>
  );
}

function OverviewWrapper() {
  return <LeaderDashboard embedded />;
}

function TeamWrapper() {
  return <TeamManage embedded />;
}

function LeaveWrapper() {
  return <Requests embedded />;
}

function DisciplineWrapper() {
  return <Discipline embedded />;
}

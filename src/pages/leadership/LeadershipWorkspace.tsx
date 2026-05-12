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
    { id: 'setlists', label: 'Setlists', icon: ListMusic, show: isLeader },
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
    <div className="page-container page-bottom-pad">
      <div className="max-w-2xl lg:max-w-5xl xl:max-w-7xl 2xl:max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-5 sm:space-y-6">

        {/* ── Header ───────────────────────────────────── */}
        <motion.div {...fadeUp(0)} className="flex items-center gap-3.5">
          <div className="relative shrink-0">
            <div
              className="absolute inset-0 rounded-2xl"
              style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.35), transparent 70%)', filter: 'blur(10px)', transform: 'scale(1.5)' }}
            />
            <div
              className="relative h-11 w-11 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(145deg, #16a34a, #15803d)', boxShadow: '0 4px 14px rgba(22,163,74,0.35)' }}
            >
              <Shield className="h-5 w-5 text-white" />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-mono font-medium uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400/80 mb-0.5">
              Admin workspace
            </p>
            <h1 className="text-[1.5rem] sm:text-[1.75rem] font-black text-gray-900 dark:text-white leading-tight" style={{ letterSpacing: '-0.03em' }}>
              Leadership.
            </h1>
          </div>
        </motion.div>

        {/* ── Tab Strip ────────────────────────────────── */}
        <motion.div
          {...fadeUp(0.05)}
          className="flex gap-1 p-1 rounded-2xl overflow-x-auto no-scrollbar"
          style={{ background: 'rgba(0,0,0,0.04)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)' }}
        >
          {visibleTabs.map(t => {
            const isActive = activeTab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className="relative flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl whitespace-nowrap flex-1 hover:bg-white/50 dark:hover:bg-white/[0.04] transition-colors"
              >
                {isActive && (
                  <motion.div
                    layoutId="leadership-tab-indicator"
                    className="absolute inset-0 rounded-xl bg-white dark:bg-white/[0.06] shadow-sm ring-1 ring-black/[0.06] dark:ring-white/[0.09]"
                    transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                  />
                )}
                <Icon className={`relative z-10 h-3.5 w-3.5 shrink-0 transition-colors duration-200 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`} />
                <span className={`relative z-10 text-[12px] sm:text-[13px] font-bold transition-colors duration-200 leading-none ${isActive ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
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

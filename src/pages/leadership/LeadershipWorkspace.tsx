import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, LayoutDashboard, Users, CalendarCheck, AlertTriangle, ListMusic, Building2, CreditCard } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useUnreadCounts } from '../../hooks/useUnreadCounts';
import { LeaderDashboard } from '../LeaderDashboard';
import { TeamManage } from '../TeamManage';
import { Requests } from '../Requests';
import { Discipline } from '../Discipline';
import { SetlistDeadlines } from './SetlistDeadlines';
import { OrganizationSettings } from './OrganizationSettings';
import { OrganizationBilling } from './OrganizationBilling';

type Tab = 'overview' | 'team' | 'leave' | 'discipline' | 'setlists' | 'church' | 'billing';

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
    { id: 'discipline', label: 'Conduct', icon: AlertTriangle, show: isLeader || !!canManageDiscipline },
    { id: 'team', label: 'Team', icon: Users, show: isLeader || isOrgAdmin },
    { id: 'church', label: 'Church', icon: Building2, show: isOrgAdmin },
    { id: 'billing', label: 'Billing', icon: CreditCard, show: isOrgAdmin },
  ];

  const visibleTabs = tabs.filter(t => t.show);

  const defaultTab = visibleTabs[0]?.id ?? 'overview';
  const activeTab: Tab = (visibleTabs.find(t => t.id === tab) ? tab as Tab : null) ?? defaultTab;

  useEffect(() => {
    if (!tab || !visibleTabs.find(t => t.id === tab)) {
      navigate(`/leadership/${defaultTab}`, { replace: true });
    }
  }, [tab]);

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
      <div className="max-w-5xl mx-auto px-1 sm:px-2 pt-6 sm:pt-8 space-y-5 sm:space-y-6">

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
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="flex gap-1 p-1 rounded-2xl overflow-x-auto no-scrollbar"
          style={{ background: 'rgba(0,0,0,0.04)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)' }}
        >
          {visibleTabs.map(t => {
            const isActive = activeTab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => navigate(`/leadership/${t.id}`)}
                className={`relative flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl transition-all duration-200 whitespace-nowrap flex-1 ${
                  isActive
                    ? 'bg-white dark:bg-white/[0.06] shadow-sm ring-1 ring-black/[0.06] dark:ring-white/[0.09]'
                    : 'hover:bg-white/50 dark:hover:bg-white/[0.04]'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 shrink-0 transition-colors ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`} />
                <span className={`text-[12px] sm:text-[13px] font-bold transition-colors leading-none ${isActive ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                  {t.label}
                </span>
                {t.id === 'leave' && unread.pendingLeave > 0 && (
                  <span className="flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold leading-none" style={{ boxShadow: '0 0 8px rgba(245,158,11,0.5)' }}>
                    {unread.pendingLeave > 9 ? '9+' : unread.pendingLeave}
                  </span>
                )}
              </button>
            );
          })}
        </motion.div>

        {/* ── Tab Content ──────────────────────────────── */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8, filter: 'blur(3px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          {activeTab === 'overview' && <OverviewWrapper />}
          {activeTab === 'team' && <TeamWrapper />}
          {activeTab === 'leave' && <LeaveWrapper />}
          {activeTab === 'discipline' && <DisciplineWrapper />}
          {activeTab === 'setlists' && <SetlistDeadlines />}
          {activeTab === 'church' && <OrganizationSettings />}
          {activeTab === 'billing' && <OrganizationBilling />}
        </motion.div>

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

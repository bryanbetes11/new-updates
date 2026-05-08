import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Shield, LayoutDashboard, Users, CalendarCheck, AlertTriangle, ListMusic } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useUnreadCounts } from '../../hooks/useUnreadCounts';
import { LeaderDashboard } from '../LeaderDashboard';
import { TeamManage } from '../TeamManage';
import { Requests } from '../Requests';
import { Discipline } from '../Discipline';
import { SetlistDeadlines } from './SetlistDeadlines';

type Tab = 'overview' | 'team' | 'leave' | 'discipline' | 'setlists';

interface TabConfig {
  id: Tab;
  label: string;
  icon: React.ElementType;
  show: boolean;
}

export function LeadershipWorkspace() {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const { isLeader, canApproveLeave, canManageDiscipline } = useAuth();
  const unread = useUnreadCounts();

  const tabs: TabConfig[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, show: isLeader },
    { id: 'setlists', label: 'Setlists', icon: ListMusic, show: isLeader },
    { id: 'leave', label: 'Leave', icon: CalendarCheck, show: !!canApproveLeave },
    { id: 'discipline', label: 'Conduct', icon: AlertTriangle, show: isLeader || !!canManageDiscipline },
    { id: 'team', label: 'Team', icon: Users, show: isLeader },
  ];

  const visibleTabs = tabs.filter(t => t.show);

  const defaultTab = visibleTabs[0]?.id ?? 'overview';
  const activeTab: Tab = (visibleTabs.find(t => t.id === tab) ? tab as Tab : null) ?? defaultTab;

  useEffect(() => {
    if (!tab || !visibleTabs.find(t => t.id === tab)) {
      navigate(`/leadership/${defaultTab}`, { replace: true });
    }
  }, [tab]);

  if (!isLeader && !canApproveLeave && !canManageDiscipline) {
    return (
      <div className="page-container page-bottom-pad flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Access Restricted</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Leadership access required.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container page-bottom-pad">
      <div className="px-4 sm:px-5 lg:px-6 pt-5 sm:pt-6 pb-2">
        <div className="flex items-center gap-3 mb-5 animate-fade-in">
          <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 shrink-0">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <h1 className="page-header">Leadership</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-tight">Admin workspace</p>
          </div>
        </div>

        <div className="flex gap-1 p-1 rounded-2xl overflow-x-auto no-scrollbar" style={{ background: 'rgba(0,0,0,0.04)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)' }}>
          {visibleTabs.map(t => {
            const isActive = activeTab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => navigate(`/leadership/${t.id}`)}
                className={`relative flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl text-[12px] sm:text-[13px] font-bold transition-all duration-200 whitespace-nowrap flex-1 ${
                  isActive
                    ? 'bg-white dark:bg-[#232325] text-gray-900 dark:text-white shadow-sm ring-1 ring-black/[0.05] dark:ring-white/[0.08]'
                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
                <span>{t.label}</span>
                {t.id === 'leave' && unread.pendingLeave > 0 && (
                  <span className="flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold leading-none">
                    {unread.pendingLeave > 9 ? '9+' : unread.pendingLeave}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="animate-fade-in">
        {activeTab === 'overview' && <OverviewWrapper />}
        {activeTab === 'team' && <TeamWrapper />}
        {activeTab === 'leave' && <LeaveWrapper />}
        {activeTab === 'discipline' && <DisciplineWrapper />}
        {activeTab === 'setlists' && <SetlistDeadlines />}
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

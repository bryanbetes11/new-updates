import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, startOfToday } from 'date-fns';
import {
  Shield, AlertTriangle, ClipboardCheck, UserX, ChevronRight,
  Clock, XCircle, AlertCircle, Users, TrendingDown
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Avatar } from '../components/Avatar';
import { PageLoader } from '../components/LoadingSpinner';
import type { Setlist, UserAvailability, DisciplineRecord, Profile } from '../types';

interface RecentOffense {
  user_id: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
  avatar_url: string | null;
  late_count: number;
  absent_count: number;
  offense_level: number;
  ministry_status: string;
}

interface DisciplineAlert extends DisciplineRecord {
  profile?: Profile;
}

function getQuarterFromDate(date: Date): number {
  return Math.ceil((date.getMonth() + 1) / 3);
}

const offenseColors: Record<number, string> = {
  1: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20',
  2: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20',
  3: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
  4: 'text-red-800 dark:text-red-200 bg-red-100 dark:bg-red-900/40',
};

const offenseLabels: Record<number, string> = {
  1: '1st Offense',
  2: '2nd Offense',
  3: '3rd Offense',
  4: '4th Offense',
};

const statusConfig: Record<string, { label: string; color: string }> = {
  open: { label: 'Open', color: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400' },
  verbal_warning: { label: 'Warning', color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300' },
  counselling: { label: 'Counselling', color: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300' },
  suspension: { label: 'Suspended', color: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' },
};

interface LeaderDashboardProps {
  embedded?: boolean;
}

export function LeaderDashboard({ embedded }: LeaderDashboardProps = {}) {
  const { isLeader, profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [recentOffenses, setRecentOffenses] = useState<RecentOffense[]>([]);
  const [disciplineAlerts, setDisciplineAlerts] = useState<DisciplineAlert[]>([]);
  const [pendingSetlists, setPendingSetlists] = useState<Setlist[]>([]);
  const [upcomingUnavailable, setUpcomingUnavailable] = useState<UserAvailability[]>([]);
  const [suspendedMembers, setSuspendedMembers] = useState<{ id: string; first_name: string; last_name: string; avatar_url: string | null; ministry_status: string }[]>([]);
  const [pendingLeave, setPendingLeave] = useState<number>(0);

  useEffect(() => {
    if (!isLeader) { setLoading(false); return; }

    const today = startOfToday().toISOString().split('T')[0];
    const currentYear = new Date().getFullYear();
    const currentQuarter = getQuarterFromDate(new Date());

    const load = async () => {
      const [offensesRes, disciplineRes, setlistsRes, unavailableRes, suspendedRes, pendingLeaveRes] = await Promise.all([
        supabase.rpc('get_all_members_attendance_stats', { p_year: currentYear, p_quarter: currentQuarter }),
        supabase.from('discipline_records')
          .select('*, profile:user_id(id, first_name, last_name, nickname, avatar_url)')
          .in('status', ['open', 'verbal_warning', 'counselling', 'suspension'])
          .order('created_at', { ascending: false })
          .limit(5),
        supabase.from('setlists')
          .select('*, events(title, event_date)')
          .eq('status', 'pending_review')
          .order('created_at', { ascending: false })
          .limit(3),
        supabase.from('user_availability')
          .select('*, profiles!user_availability_user_id_fkey(first_name, last_name, avatar_url, nickname)')
          .eq('status', 'approved')
          .gte('unavailable_date', today)
          .order('unavailable_date')
          .limit(5),
        supabase.from('profiles')
          .select('id, first_name, last_name, avatar_url, ministry_status')
          .in('ministry_status', ['suspended', 'restoration'])
          .eq('is_onboarded', true),
        supabase.from('user_availability')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
      ]);

      const offenseData = (offensesRes.data || []) as RecentOffense[];
      setRecentOffenses(offenseData.filter(m => m.offense_level > 0).slice(0, 6));
      setDisciplineAlerts((disciplineRes.data || []) as DisciplineAlert[]);
      setPendingSetlists((setlistsRes.data || []) as Setlist[]);
      setUpcomingUnavailable((unavailableRes.data || []) as UserAvailability[]);
      setSuspendedMembers((suspendedRes.data || []) as typeof suspendedMembers);
      setPendingLeave(pendingLeaveRes.count || 0);
      setLoading(false);
    };

    load();
  }, [isLeader]);

  if (loading) return <PageLoader />;

  if (!isLeader) {
    return (
      <div className={embedded ? 'flex items-center justify-center min-h-[40vh]' : 'page-container page-bottom-pad flex items-center justify-center min-h-[60vh]'}>
        <div className="text-center">
          <Shield className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Access Restricted</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Only leaders can access this dashboard.</p>
        </div>
      </div>
    );
  }

  const widgets = [
    {
      label: 'With Offenses',
      value: recentOffenses.length,
      icon: AlertTriangle,
      urgent: recentOffenses.length > 0,
      activeColor: 'from-red-500 to-red-600',
      activeBg: 'bg-red-50 dark:bg-red-900/20',
      activeText: 'text-red-600 dark:text-red-400',
      neutralColor: 'text-green-600 dark:text-green-400',
      neutralBg: 'bg-green-50 dark:bg-green-900/20',
      onClick: () => navigate(embedded ? '/leadership/team?tab=attendance' : '/manage?tab=attendance'),
    },
    {
      label: 'Discipline Open',
      value: disciplineAlerts.length,
      icon: Shield,
      urgent: disciplineAlerts.length > 0,
      activeColor: 'from-orange-500 to-orange-600',
      activeBg: 'bg-orange-50 dark:bg-orange-900/20',
      activeText: 'text-orange-600 dark:text-orange-400',
      neutralColor: 'text-green-600 dark:text-green-400',
      neutralBg: 'bg-green-50 dark:bg-green-900/20',
      onClick: () => navigate(embedded ? '/leadership/discipline' : '/discipline'),
    },
    {
      label: 'Pending Leave',
      value: pendingLeave,
      icon: UserX,
      urgent: pendingLeave > 0,
      activeColor: 'from-amber-500 to-amber-600',
      activeBg: 'bg-amber-50 dark:bg-amber-900/20',
      activeText: 'text-amber-600 dark:text-amber-400',
      neutralColor: 'text-gray-500 dark:text-gray-400',
      neutralBg: 'bg-gray-100 dark:bg-gray-800',
      onClick: () => navigate(embedded ? '/leadership/leave' : '/requests'),
    },
    {
      label: 'Setlists to Review',
      value: pendingSetlists.length,
      icon: ClipboardCheck,
      urgent: pendingSetlists.length > 0,
      activeColor: 'from-blue-500 to-blue-600',
      activeBg: 'bg-blue-50 dark:bg-blue-900/20',
      activeText: 'text-blue-600 dark:text-blue-400',
      neutralColor: 'text-gray-500 dark:text-gray-400',
      neutralBg: 'bg-gray-100 dark:bg-gray-800',
      onClick: () => navigate('/library'),
    },
  ];

  function DashCard({ title, icon, iconColor, badge, linkLabel, onLink, children, delay }: {
    title: string; icon: React.ElementType; iconColor: string; badge?: number; linkLabel?: string; onLink?: () => void; children: React.ReactNode; delay?: string;
  }) {
    const Icon = icon;
    return (
      <div className="rounded-2xl overflow-hidden bg-white dark:bg-[#1a1a1c] ring-1 ring-black/[0.05] dark:ring-white/[0.06] animate-slide-up" style={{ animationDelay: delay, animationFillMode: 'both', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-black/[0.04] dark:border-white/[0.05]">
          <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} />
          <h2 className="text-sm font-bold text-gray-900 dark:text-white flex-1">{title}</h2>
          {badge !== undefined && badge > 0 && <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">{badge}</span>}
          {linkLabel && onLink && <button onClick={onLink} className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 transition-colors flex items-center gap-0.5">{linkLabel} <ChevronRight className="h-3 w-3" /></button>}
        </div>
        {children}
      </div>
    );
  }

  const inner = (
    <div className="px-4 sm:px-5 lg:px-6 py-5 sm:py-6 space-y-5">

        {!embedded && (
          <div className="flex items-center gap-3 animate-fade-in">
            <div className="h-11 w-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg,#059669,#047857)', boxShadow: '0 3px 12px rgba(5,150,105,0.3)' }}>
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-[1.375rem] font-black text-gray-900 dark:text-white leading-tight" style={{ letterSpacing: '-0.03em' }}>Overview</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Ministry health, alerts & pending actions</p>
            </div>
          </div>
        )}

        {/* Metric widgets */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-slide-up">
          {widgets.map(w => (
            <button key={w.label} onClick={w.onClick}
              className="rounded-2xl p-4 text-left transition-all duration-200 hover:-translate-y-px active:scale-[0.98] bg-white dark:bg-[#1a1a1c] ring-1 ring-black/[0.05] dark:ring-white/[0.06] hover:ring-black/[0.08] dark:hover:ring-white/[0.09]"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
            >
              <div className={`inline-flex items-center justify-center h-9 w-9 rounded-xl mb-3 ${w.urgent ? w.activeBg : w.neutralBg}`}>
                <w.icon className={`h-4 w-4 ${w.urgent ? w.activeText : w.neutralColor}`} />
              </div>
              <p className={`text-2xl font-black leading-none ${w.urgent ? w.activeText : 'text-gray-800 dark:text-gray-200'}`} style={{ letterSpacing: '-0.04em' }}>{w.value}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 font-medium">{w.label}</p>
            </button>
          ))}
        </div>

        {/* Main grid */}
        <div className="grid gap-4 lg:grid-cols-2">
          <DashCard title="Attendance Alerts" icon={AlertTriangle} iconColor="text-amber-500"
            badge={recentOffenses.length}
            linkLabel="Full Report"
            onLink={() => navigate(embedded ? '/leadership/team?tab=attendance' : '/manage?tab=attendance')}
            delay="50ms"
          >
            <div className="divide-y divide-black/[0.03] dark:divide-white/[0.04]">
              {recentOffenses.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-gray-400">All members in good standing</p>
              ) : (
                recentOffenses.map(m => (
                  <div key={m.user_id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar src={m.avatar_url} firstName={m.first_name} lastName={m.last_name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{m.first_name} {m.last_name}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">{m.late_count}L · {m.absent_count}A</p>
                    </div>
                    <span className={`text-[11px] px-2 py-1 rounded-xl font-bold ${offenseColors[m.offense_level] || ''}`}>{offenseLabels[m.offense_level]}</span>
                  </div>
                ))
              )}
            </div>
          </DashCard>

          <DashCard title="Open Discipline" icon={Shield} iconColor="text-red-500"
            badge={disciplineAlerts.length}
            linkLabel="View All"
            onLink={() => navigate(embedded ? '/leadership/discipline' : '/discipline')}
            delay="80ms"
          >
            <div className="divide-y divide-black/[0.03] dark:divide-white/[0.04]">
              {disciplineAlerts.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-gray-400">No open discipline records</p>
              ) : (
                disciplineAlerts.map(d => {
                  const sCfg = statusConfig[d.status] || statusConfig.open;
                  return (
                    <button key={d.id} onClick={() => navigate(embedded ? '/leadership/discipline' : '/discipline')}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50/60 dark:hover:bg-white/[0.02] transition-colors text-left"
                    >
                      {d.profile && <Avatar src={d.profile.avatar_url} firstName={d.profile.first_name} lastName={d.profile.last_name} size="sm" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{d.title}</p>
                        {d.profile && <p className="text-[11px] text-gray-500 dark:text-gray-400">{d.profile.first_name} {d.profile.last_name}</p>}
                      </div>
                      <span className={`text-[11px] px-2 py-0.5 rounded-lg font-semibold shrink-0 ${sCfg.color}`}>{sCfg.label}</span>
                    </button>
                  );
                })
              )}
            </div>
          </DashCard>

          <DashCard title="Upcoming Unavailable" icon={UserX} iconColor="text-orange-500"
            badge={upcomingUnavailable.length}
            linkLabel="View All"
            onLink={() => navigate('/unavailable-members')}
            delay="110ms"
          >
            <div className="divide-y divide-black/[0.03] dark:divide-white/[0.04]">
              {upcomingUnavailable.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-gray-400">No upcoming unavailability</p>
              ) : (
                upcomingUnavailable.map(ua => (
                  <div key={ua.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex flex-col items-center justify-center h-10 w-10 rounded-xl shrink-0" style={{ background: 'linear-gradient(135deg,#fed7aa,#fdba74)' }}>
                      <span className="text-[9px] font-black uppercase text-orange-800 leading-none">{format(parseISO(ua.unavailable_date), 'MMM')}</span>
                      <span className="text-base font-black text-orange-800 leading-none mt-0.5" style={{ letterSpacing: '-0.04em' }}>{format(parseISO(ua.unavailable_date), 'd')}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{ua.profiles?.first_name} {ua.profiles?.last_name}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{ua.reason || 'No reason given'}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </DashCard>

          <DashCard title="Special Status Members" icon={Users} iconColor="text-gray-400 dark:text-gray-500"
            linkLabel="Manage"
            onLink={() => navigate(embedded ? '/leadership/team' : '/manage')}
            delay="140ms"
          >
            <div className="divide-y divide-black/[0.03] dark:divide-white/[0.04]">
              {suspendedMembers.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-gray-400">No members on suspension or restoration</p>
              ) : (
                suspendedMembers.map(m => (
                  <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar src={m.avatar_url} firstName={m.first_name} lastName={m.last_name} size="sm" />
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate flex-1">{m.first_name} {m.last_name}</p>
                    <span className={`text-[11px] px-2 py-1 rounded-xl font-semibold capitalize ${m.ministry_status === 'suspended' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'}`}>{m.ministry_status}</span>
                  </div>
                ))
              )}
            </div>
          </DashCard>
        </div>

        {pendingSetlists.length > 0 && (
          <DashCard title="Pending Setlist Approvals" icon={AlertCircle} iconColor="text-amber-500"
            badge={pendingSetlists.length}
            delay="170ms"
          >
            <div className="divide-y divide-black/[0.03] dark:divide-white/[0.04]">
              {pendingSetlists.map(s => (
                <button key={s.id} onClick={() => navigate(`/events/${s.event_id}`)}
                  className="flex items-center gap-3 px-5 py-3.5 w-full text-left hover:bg-gray-50/60 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{s.events?.title}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">{s.events?.event_date && format(parseISO(s.events.event_date), 'MMM d, yyyy')}</p>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-1 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 shrink-0">Needs Review</span>
                  <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                </button>
              ))}
            </div>
          </DashCard>
        )}
      </div>
  );

  if (embedded) return inner;

  return (
    <div className="page-container page-bottom-pad">
      {inner}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, startOfToday } from 'date-fns';
import { motion } from 'framer-motion';
import {
  Shield, AlertTriangle, ClipboardCheck, UserX, ChevronRight,
  AlertCircle, Users
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
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
  1: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/[0.12] border border-amber-200 dark:border-amber-500/25',
  2: 'text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-500/[0.12] border border-orange-200 dark:border-orange-500/25',
  3: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/[0.12] border border-red-200 dark:border-red-500/25',
  4: 'text-red-800 dark:text-red-200 bg-red-100 dark:bg-red-500/[0.18] border border-red-300 dark:border-red-500/40',
};

const offenseLabels: Record<number, string> = {
  1: '1st Offense',
  2: '2nd Offense',
  3: '3rd Offense',
  4: '4th Offense',
};

const statusConfig: Record<string, { label: string; color: string }> = {
  open:           { label: 'Open',        color: 'bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-white/55 border border-gray-200 dark:border-white/[0.08]' },
  verbal_warning: { label: 'Warning',     color: 'bg-amber-50 dark:bg-amber-500/[0.12] text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/25' },
  counselling:    { label: 'Counselling', color: 'bg-orange-50 dark:bg-orange-500/[0.12] text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-500/25' },
  suspension:     { label: 'Suspended',   color: 'bg-red-50 dark:bg-red-500/[0.12] text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/25' },
};

interface LeaderDashboardProps {
  embedded?: boolean;
}

export function LeaderDashboard({ embedded }: LeaderDashboardProps = {}) {
  const { isLeader } = useAuth();
  const navigate = useNavigate();
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
      tone: { bg: 'bg-red-50 dark:bg-red-500/[0.12]', text: 'text-red-600 dark:text-red-400', dot: '#ef4444' },
      neutral: { bg: 'bg-emerald-50 dark:bg-emerald-500/[0.10]', text: 'text-emerald-600 dark:text-emerald-400', dot: '#22c55e' },
      onClick: () => navigate('/leadership/team?tab=attendance'),
    },
    {
      label: 'Discipline Open',
      value: disciplineAlerts.length,
      icon: Shield,
      urgent: disciplineAlerts.length > 0,
      tone: { bg: 'bg-orange-50 dark:bg-orange-500/[0.12]', text: 'text-orange-600 dark:text-orange-400', dot: '#f97316' },
      neutral: { bg: 'bg-emerald-50 dark:bg-emerald-500/[0.10]', text: 'text-emerald-600 dark:text-emerald-400', dot: '#22c55e' },
      onClick: () => navigate('/leadership/discipline'),
    },
    {
      label: 'Pending Leave',
      value: pendingLeave,
      icon: UserX,
      urgent: pendingLeave > 0,
      tone: { bg: 'bg-amber-50 dark:bg-amber-500/[0.12]', text: 'text-amber-600 dark:text-amber-400', dot: '#f59e0b' },
      neutral: { bg: 'bg-gray-100 dark:bg-white/[0.06]', text: 'text-gray-500 dark:text-white/45', dot: 'rgba(156,163,175,0.7)' },
      onClick: () => navigate('/leadership/leave'),
    },
    {
      label: 'Setlists to Review',
      value: pendingSetlists.length,
      icon: ClipboardCheck,
      urgent: pendingSetlists.length > 0,
      tone: { bg: 'bg-sky-50 dark:bg-sky-500/[0.12]', text: 'text-sky-600 dark:text-sky-400', dot: '#0ea5e9' },
      neutral: { bg: 'bg-gray-100 dark:bg-white/[0.06]', text: 'text-gray-500 dark:text-white/45', dot: 'rgba(156,163,175,0.7)' },
      onClick: () => navigate('/library'),
    },
  ];

  function SectionLabel({ index, children, action }: { index: string; children: React.ReactNode; action?: React.ReactNode }) {
    return (
      <div className="flex items-end justify-between mb-3 px-0.5">
        <div className="flex items-baseline gap-2.5">
          <span className="text-[10px] font-mono font-semibold tabular-nums text-gray-400/70 dark:text-white/25 tracking-widest">{index}</span>
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-white/45">{children}</span>
        </div>
        {action}
      </div>
    );
  }

  function DashCard({ index, title, icon, iconColor, badge, linkLabel, onLink, children }: {
    index: string; title: string; icon: React.ElementType; iconColor: string; badge?: number; linkLabel?: string; onLink?: () => void; children: React.ReactNode;
  }) {
    const Icon = icon;
    return (
      <motion.div
        initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative rounded-3xl overflow-hidden bg-white dark:bg-white/[0.025] border border-gray-200/80 dark:border-white/[0.06]"
        style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px -12px rgba(15,23,42,0.10)' }}
      >
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.06] dark:via-white/[0.12] to-transparent" />

        <div className="relative px-5 py-4 border-b border-black/[0.04] dark:border-white/[0.05]">
          <SectionLabel
            index={index}
            action={
              linkLabel && onLink ? (
                <button onClick={onLink} className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400/80 hover:text-emerald-500 dark:hover:text-emerald-300 flex items-center gap-1 transition-colors">
                  {linkLabel} <ChevronRight className="h-3 w-3" />
                </button>
              ) : undefined
            }
          >
            <span className="flex items-center gap-1.5">
              <Icon className={`h-3 w-3 ${iconColor}`} />
              {title}
              {badge !== undefined && badge > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-md bg-red-50 dark:bg-red-500/[0.18] text-red-600 dark:text-red-400 text-[9px] font-black border border-red-200 dark:border-red-500/25">
                  {badge}
                </span>
              )}
            </span>
          </SectionLabel>
        </div>
        {children}
      </motion.div>
    );
  }

  const inner = (
    <div className={embedded ? 'space-y-5' : 'space-y-5 sm:space-y-6'}>

        {!embedded && (
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
                Ministry health
              </p>
              <h1 className="text-[1.5rem] sm:text-[1.75rem] font-black text-gray-900 dark:text-white leading-tight" style={{ letterSpacing: '-0.03em' }}>
                Overview.
              </h1>
            </div>
          </motion.div>
        )}

        {/* Metric widgets */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        >
          {widgets.map(w => {
            const t = w.urgent ? w.tone : w.neutral;
            return (
              <button
                key={w.label}
                onClick={w.onClick}
                className="group relative rounded-3xl p-4 text-left bg-white dark:bg-white/[0.025] border border-gray-200/80 dark:border-white/[0.06] hover:border-gray-300 dark:hover:border-white/[0.1] hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.98] overflow-hidden"
                style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 4px 14px -8px rgba(15,23,42,0.08)' }}
              >
                <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.05] dark:via-white/[0.08] to-transparent" />
                <div className={`inline-flex items-center justify-center h-9 w-9 rounded-2xl mb-3 ${t.bg}`}>
                  <w.icon className={`h-4 w-4 ${t.text}`} />
                </div>
                <p className={`text-[26px] font-black leading-none tabular-nums ${w.urgent ? t.text : 'text-gray-900 dark:text-white'}`} style={{ letterSpacing: '-0.04em' }}>{w.value}</p>
                <p className="text-[11px] text-gray-500 dark:text-white/45 mt-2 font-medium">{w.label}</p>
              </button>
            );
          })}
        </motion.div>

        {/* Main grid */}
        <div className="grid gap-4 lg:grid-cols-2">
          <DashCard index="01" title="Attendance Alerts" icon={AlertTriangle} iconColor="text-amber-500"
            badge={recentOffenses.length}
            linkLabel="Full Report"
            onLink={() => navigate('/leadership/team?tab=attendance')}
          >
            <div className="divide-y divide-black/[0.03] dark:divide-white/[0.04]">
              {recentOffenses.length === 0 ? (
                <p className="px-5 py-8 text-center text-[13px] text-gray-400 dark:text-white/30">All members in good standing</p>
              ) : (
                recentOffenses.map(m => (
                  <div key={m.user_id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar src={m.avatar_url} firstName={m.first_name} lastName={m.last_name} size="sm" className="ring-1 ring-black/[0.06] dark:ring-white/[0.08]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-gray-900 dark:text-white truncate" style={{ letterSpacing: '-0.01em' }}>{m.first_name} {m.last_name}</p>
                      <p className="text-[11px] font-mono text-gray-400 dark:text-white/30 mt-0.5 tracking-wide">{m.late_count}L · {m.absent_count}A</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-lg font-bold ${offenseColors[m.offense_level] || ''}`}>{offenseLabels[m.offense_level]}</span>
                  </div>
                ))
              )}
            </div>
          </DashCard>

          <DashCard index="02" title="Open Discipline" icon={Shield} iconColor="text-red-500"
            badge={disciplineAlerts.length}
            linkLabel="View All"
            onLink={() => navigate('/leadership/discipline')}
          >
            <div className="divide-y divide-black/[0.03] dark:divide-white/[0.04]">
              {disciplineAlerts.length === 0 ? (
                <p className="px-5 py-8 text-center text-[13px] text-gray-400 dark:text-white/30">No open discipline records</p>
              ) : (
                disciplineAlerts.map(d => {
                  const sCfg = statusConfig[d.status] || statusConfig.open;
                  return (
                    <button key={d.id} onClick={() => navigate('/leadership/discipline')}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50/60 dark:hover:bg-white/[0.02] transition-colors text-left"
                    >
                      {d.profile && <Avatar src={d.profile.avatar_url} firstName={d.profile.first_name} lastName={d.profile.last_name} size="sm" className="ring-1 ring-black/[0.06] dark:ring-white/[0.08]" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-gray-900 dark:text-white truncate" style={{ letterSpacing: '-0.01em' }}>{d.title}</p>
                        {d.profile && <p className="text-[11px] text-gray-400 dark:text-white/30 mt-0.5">{d.profile.first_name} {d.profile.last_name}</p>}
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-lg font-bold shrink-0 ${sCfg.color}`}>{sCfg.label}</span>
                    </button>
                  );
                })
              )}
            </div>
          </DashCard>

          <DashCard index="03" title="Upcoming Unavailable" icon={UserX} iconColor="text-orange-500"
            badge={upcomingUnavailable.length}
            linkLabel="View All"
            onLink={() => navigate('/unavailable-members')}
          >
            <div className="divide-y divide-black/[0.03] dark:divide-white/[0.04]">
              {upcomingUnavailable.length === 0 ? (
                <p className="px-5 py-8 text-center text-[13px] text-gray-400 dark:text-white/30">No upcoming unavailability</p>
              ) : (
                upcomingUnavailable.map(ua => {
                  const representativeDate = ua.unavailable_date || ua.start_date || ua.end_date || new Date().toISOString();
                  return (
                  <div key={ua.id} className="flex items-center gap-3 px-5 py-3">
                    <div
                      className="relative flex flex-col items-center justify-center h-11 w-11 rounded-xl shrink-0"
                      style={{ background: 'linear-gradient(145deg,#fb923c,#ea580c)', boxShadow: '0 3px 10px rgba(249,115,22,0.3)' }}
                    >
                      <span className="text-[8px] font-black uppercase tracking-widest leading-none text-white/65">{format(parseISO(representativeDate), 'MMM')}</span>
                      <span className="text-[16px] font-black leading-none mt-0.5 text-white" style={{ letterSpacing: '-0.04em' }}>{format(parseISO(representativeDate), 'd')}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-gray-900 dark:text-white truncate" style={{ letterSpacing: '-0.01em' }}>{ua.profiles?.first_name} {ua.profiles?.last_name}</p>
                      <p className="text-[11px] text-gray-500 dark:text-white/40 truncate mt-0.5">{ua.reason || 'No reason given'}</p>
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </DashCard>

          <DashCard index="04" title="Special Status Members" icon={Users} iconColor="text-gray-400 dark:text-white/35"
            linkLabel="Manage"
            onLink={() => navigate('/leadership/team')}
          >
            <div className="divide-y divide-black/[0.03] dark:divide-white/[0.04]">
              {suspendedMembers.length === 0 ? (
                <p className="px-5 py-8 text-center text-[13px] text-gray-400 dark:text-white/30">No members on suspension or restoration</p>
              ) : (
                suspendedMembers.map(m => (
                  <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar src={m.avatar_url} firstName={m.first_name} lastName={m.last_name} size="sm" className="ring-1 ring-black/[0.06] dark:ring-white/[0.08]" />
                    <p className="text-[13px] font-bold text-gray-900 dark:text-white truncate flex-1" style={{ letterSpacing: '-0.01em' }}>{m.first_name} {m.last_name}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-lg font-bold capitalize ${m.ministry_status === 'suspended' ? 'bg-red-50 dark:bg-red-500/[0.12] text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/25' : 'bg-amber-50 dark:bg-amber-500/[0.12] text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/25'}`}>{m.ministry_status}</span>
                  </div>
                ))
              )}
            </div>
          </DashCard>
        </div>

        {pendingSetlists.length > 0 && (
          <DashCard index="05" title="Pending Setlist Approvals" icon={AlertCircle} iconColor="text-amber-500"
            badge={pendingSetlists.length}
          >
            <div className="divide-y divide-black/[0.03] dark:divide-white/[0.04]">
              {pendingSetlists.map(s => (
                <button key={s.id} onClick={() => navigate(`/events/${s.event_id}`)}
                  className="flex items-center gap-3 px-5 py-3.5 w-full text-left hover:bg-gray-50/60 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-gray-900 dark:text-white" style={{ letterSpacing: '-0.01em' }}>{s.events?.title}</p>
                    <p className="text-[11px] font-mono text-gray-400 dark:text-white/30 mt-0.5 tracking-wide">{s.events?.event_date && format(parseISO(s.events.event_date), 'MMM d, yyyy')}</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-500/[0.12] text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/25 shrink-0">Needs Review</span>
                  <ChevronRight className="h-3.5 w-3.5 text-gray-400 dark:text-white/25 shrink-0" />
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
      <div className="max-w-5xl mx-auto px-1 sm:px-2 pt-6 sm:pt-8">
        {inner}
      </div>
    </div>
  );
}

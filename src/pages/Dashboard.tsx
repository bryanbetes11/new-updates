import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { differenceInCalendarDays, format, isAfter, parseISO, startOfToday } from 'date-fns';
import { motion } from 'framer-motion';
import { Calendar, CheckCircle, Clock, Music, ChevronRight, Megaphone, Image as ImageIcon, UserX, Trash2, ArrowUpRight, LayoutDashboard, Users, ClipboardCheck, ListChecks, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { DashboardSkeleton } from '../components/LoadingSpinner';
import { Avatar } from '../components/Avatar';
import { formatTime12Hour } from '../lib/timeFormat';
import { Modal } from '../components/Modal';
import type { Event, EventAssignment, Setlist, Announcement, UserAvailability } from '../types';

const verses = [
  { text: 'Shout with joy to the Lord, all the earth!', ref: 'Psalm 100:1 NLT' },
  { text: 'Sing a new song of praise to him; play skillfully on the harp, and sing with joy.', ref: 'Psalm 33:3 NLT' },
  { text: 'Let everything that breathes sing praises to the Lord! Praise the Lord!', ref: 'Psalm 150:6 NLT' },
  { text: 'Singing psalms and hymns and spiritual songs among yourselves, and making music to the Lord in your hearts.', ref: 'Ephesians 5:19 NLT' },
  { text: 'I will sing to the Lord as long as I live. I will praise my God to my last breath!', ref: 'Psalm 104:33 NLT' },
  { text: 'Come, let us sing to the Lord! Let us shout joyfully to the Rock of our salvation.', ref: 'Psalm 95:1 NLT' },
  { text: 'Worship the Lord with gladness. Come before him, singing with joy.', ref: 'Psalm 100:2 NLT' },
];

const container = {
  initial: {},
  animate: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
const item = {
  initial: { opacity: 0, y: 18, filter: 'blur(6px)' },
  animate: {
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

const MANILA_TIMEZONE = 'Asia/Manila';

function getManilaTodayKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getManilaEventDateTime(eventDate: string, timeValue: string | null | undefined) {
  if (!timeValue) return new Date(`${eventDate}T23:59:59+08:00`);
  return new Date(`${eventDate}T${timeValue}+08:00`);
}

// Premium card — soft dual-shadow, theme-aware border, subtle inner top-edge highlight
function Card({ children, className = '', interactive = false }: { children: React.ReactNode; className?: string; interactive?: boolean }) {
  return (
    <div
      className={`group relative overflow-hidden rounded-3xl bg-white dark:bg-white/[0.025] border border-gray-200/80 dark:border-white/[0.06] transition-all duration-300 ${
        interactive ? 'hover:-translate-y-0.5 hover:border-gray-300 dark:hover:border-white/[0.1]' : ''
      } ${className}`}
      style={{
        boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 28px -16px rgba(15,23,42,0.12)',
      }}
    >
      {/* Inner top-edge highlight — luminous in dark, faint in light */}
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.06] dark:via-white/[0.12] to-transparent" />
      {children}
    </div>
  );
}

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

function DateChip({ date, dim = false }: { date: string | null; dim?: boolean }) {
  if (!date) return <div className="h-[52px] w-11 rounded-xl shrink-0 bg-gray-100 dark:bg-white/[0.04]" />;
  const parsed = parseISO(date);
  return (
    <div
      className={`relative flex flex-col items-center justify-center h-[52px] w-11 rounded-xl shrink-0 ${dim ? 'bg-gray-100 dark:bg-white/[0.05]' : ''}`}
      style={dim ? {} : { background: 'linear-gradient(145deg,#16a34a,#15803d)', boxShadow: '0 3px 10px rgba(22,163,74,0.3)' }}
    >
      <span className={`text-[9px] font-black uppercase tracking-widest leading-none ${dim ? 'text-gray-400 dark:text-white/25' : 'text-white/65'}`}>
        {format(parsed, 'MMM')}
      </span>
      <span className={`text-[22px] font-black leading-none mt-0.5 ${dim ? 'text-gray-500 dark:text-white/35' : 'text-white'}`} style={{ letterSpacing: '-0.04em' }}>
        {format(parsed, 'd')}
      </span>
      <span className={`text-[8px] font-bold leading-none mt-0.5 ${dim ? 'text-gray-400 dark:text-white/20' : 'text-white/50'}`}>
        {format(parsed, 'EEE')}
      </span>
    </div>
  );
}

export function Dashboard() {
  const { user, profile, isLeader, isProductionDirector } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [myAssignments, setMyAssignments] = useState<EventAssignment[]>([]);
  const [songLeaderByEvent, setSongLeaderByEvent] = useState<Record<string, string>>({});
  const [pendingSetlists, setPendingSetlists] = useState<Setlist[]>([]);
  const [recentAnnouncements, setRecentAnnouncements] = useState<Announcement[]>([]);
  const [unavailableMembers, setUnavailableMembers] = useState<UserAvailability[]>([]);
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0);
  const [stats, setStats] = useState({ total: 0, confirmed: 0, pending: 0 });
  const [selectedUnavailability, setSelectedUnavailability] = useState<UserAvailability | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [now, setNow] = useState(new Date());

  const todayVerse = verses[new Date().getDay() % verses.length];

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!user) return;
    const today = getManilaTodayKey();
    const load = async () => {
      const [eventsRes, assignRes, setlistsRes, announcementsRes, unavailableRes, pendingLeaveRes] = await Promise.all([
        supabase.from('events').select('*').gte('event_date', today).order('event_date').limit(5),
        supabase.from('event_assignments').select('*, events(*), roles(*)').eq('user_id', user.id).order('created_at', { ascending: false }),
        isLeader
          ? supabase.from('setlists').select('*, events(title, event_date)').eq('status', 'pending_review').order('created_at', { ascending: false })
          : Promise.resolve({ data: [] }),
        supabase.from('announcements').select('*, profiles!announcements_created_by_fkey(first_name, last_name)').order('created_at', { ascending: false }).limit(3),
        supabase.from('user_availability').select('*, profiles!user_availability_user_id_fkey(first_name, last_name, nickname, avatar_url)').eq('status', 'approved').or(`unavailable_date.gte.${today},end_date.gte.${today}`).order('created_at', { ascending: true }),
        isLeader
          ? supabase.from('user_availability').select('id', { count: 'exact', head: true }).eq('status', 'pending')
          : Promise.resolve({ count: 0 }),
      ]);

      setUpcomingEvents(eventsRes.data || []);
      const assignments = (assignRes.data || []) as EventAssignment[];
      const upcomingAssignments = assignments.filter(a => a.events && isAfter(parseISO(a.events.event_date), startOfToday()));
      upcomingAssignments.sort((a, b) => parseISO(a.events!.event_date).getTime() - parseISO(b.events!.event_date).getTime());
      setMyAssignments(upcomingAssignments);
      const nextEventIds = [...new Set(upcomingAssignments.map(a => a.event_id))].slice(0, 5);
      if (nextEventIds.length > 0) {
        const { data: songLeaderAssignments } = await supabase
          .from('event_assignments')
          .select('event_id, profiles(first_name, last_name, gender), roles(name)')
          .in('event_id', nextEventIds);
        const leaders: Record<string, string> = {};
        (songLeaderAssignments || []).forEach((assignment: any) => {
          if (assignment.roles?.name !== 'Song Leader' || leaders[assignment.event_id]) return;
          const firstName = assignment.profiles?.first_name || '';
          const lastName = assignment.profiles?.last_name || '';
          const gender = assignment.profiles?.gender || '';
          const prefix = gender === 'male' ? 'Bro.' : gender === 'female' ? 'Sis.' : '';
          const lastInitial = lastName ? lastName[0].toUpperCase() + '.' : '';
          const name = prefix
            ? `${prefix} ${firstName} ${lastInitial}`.trim()
            : `${firstName} ${lastInitial}`.trim();
          if (name) leaders[assignment.event_id] = name;
        });
        setSongLeaderByEvent(leaders);
      } else {
        setSongLeaderByEvent({});
      }
      setPendingSetlists((setlistsRes.data || []) as Setlist[]);
      setRecentAnnouncements((announcementsRes.data || []) as Announcement[]);
      setUnavailableMembers((unavailableRes.data || []) as UserAvailability[]);
      setPendingLeaveCount(pendingLeaveRes.count || 0);
      const upcoming = assignments.filter(a => a.events && isAfter(parseISO(a.events.event_date), startOfToday()));
      setStats({ total: upcoming.length, confirmed: upcoming.filter(a => a.status === 'confirmed').length, pending: upcoming.filter(a => a.status === 'pending').length });
      setLoading(false);
    };
    load();
  }, [user, isLeader]);

  const handleConfirmDelete = async () => {
    if (!selectedUnavailability) return;
    const { error } = await supabase.from('user_availability').delete().eq('id', selectedUnavailability.id);
    if (!error) { setUnavailableMembers(prev => prev.filter(u => u.id !== selectedUnavailability.id)); setSelectedUnavailability(null); setShowDeleteConfirm(false); }
  };

  if (loading) return <div className="page-container"><DashboardSkeleton /></div>;

  const displayName = profile?.nickname || profile?.first_name || 'there';
  const greeting = (() => {
    const h = now.getHours();
    if (h < 5) return 'Good night';
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const nextEvent = upcomingEvents.find(event => getManilaEventDateTime(event.event_date, event.start_time) >= now) ?? upcomingEvents[0];
  const daysUntilNext = nextEvent
    ? Math.max(0, differenceInCalendarDays(parseISO(nextEvent.event_date), parseISO(getManilaTodayKey(now))))
    : null;
  const nextAssignment = myAssignments[0];
  const nextSongLeader = nextAssignment ? songLeaderByEvent[nextAssignment.event_id] : '';

  return (
    <div className="page-container page-bottom-pad relative">
      <motion.div
        variants={container}
        initial="initial"
        animate="animate"
        className="max-w-2xl lg:max-w-5xl xl:max-w-7xl 2xl:max-w-[1680px] mx-auto pt-7 sm:pt-10 pb-4 px-4 sm:px-6 lg:px-8 space-y-5 sm:space-y-6"
      >

        {/* ── 01 · Editorial Hero ── */}
        <motion.section variants={item} className="pb-2">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5 mb-4">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 dark:bg-emerald-400 opacity-70 animate-ping" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500 dark:bg-emerald-400" />
                </span>
                <p className="text-[10px] font-mono font-medium uppercase tracking-[0.22em] text-gray-500 dark:text-white/45">
                  {format(now, 'EEE, MMM d')} <span className="text-gray-300 dark:text-white/20 mx-1.5">·</span> {format(now, 'h:mm a')}
                </p>
              </div>

              <p className="text-[14px] font-light text-gray-500 dark:text-white/45 mb-1 tracking-tight">{greeting},</p>
              <h1
                className="text-[2.6rem] sm:text-[3.4rem] lg:text-[4rem] font-black leading-[0.98] tracking-tighter text-gray-900"
                style={{ letterSpacing: '-0.045em' }}
              >
                <span className="dark:hidden">{displayName}.</span>
                <span
                  className="hidden dark:inline"
                  style={{
                    background: 'linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,0.55) 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {displayName}.
                </span>
              </h1>

              {daysUntilNext !== null && (
                <p className="text-[13px] sm:text-[14px] text-gray-500 dark:text-white/40 mt-4 font-light max-w-md leading-relaxed">
                  {daysUntilNext === 0 ? (
                    <>Service is <span className="text-emerald-600 dark:text-emerald-300 font-medium">today</span>. {nextEvent?.start_time && `Starts ${formatTime12Hour(nextEvent.start_time)}.`}</>
                  ) : daysUntilNext === 1 ? (
                    <>Next service is <span className="text-emerald-600 dark:text-emerald-300 font-medium">tomorrow</span>.</>
                  ) : (
                    <>Next service in <span className="text-gray-900 dark:text-white/70 font-medium">{daysUntilNext} days</span>.</>
                  )}
                </p>
              )}
            </div>

            <button onClick={() => navigate('/profile')} className="shrink-0 relative group">
              <div
                className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: 'radial-gradient(circle, rgba(34,197,94,0.35), transparent 70%)', filter: 'blur(12px)', transform: 'scale(1.4)' }}
              />
              <Avatar
                src={profile?.avatar_url}
                firstName={profile?.first_name || '?'}
                lastName={profile?.last_name}
                size="lg"
                className="relative ring-1 ring-black/10 dark:ring-white/10 transition-transform duration-300 group-hover:scale-[1.06]"
              />
              {stats.pending > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-amber-400 ring-[2.5px] ring-white dark:ring-[#0d0d0f]" style={{ boxShadow: '0 0 12px rgba(245,158,11,0.6)' }} />
              )}
            </button>
          </div>

          {/* Floating glass stat pills */}
          <div className="mt-8 flex flex-wrap gap-2">
            {[
              { label: 'Upcoming', value: stats.total, dot: 'rgba(107,114,128,0.7)', dotDark: 'rgba(255,255,255,0.45)' },
              { label: 'Confirmed', value: stats.confirmed, dot: '#22c55e', dotDark: '#22c55e' },
              { label: 'Pending', value: stats.pending, dot: stats.pending > 0 ? '#f59e0b' : 'rgba(156,163,175,0.6)', dotDark: stats.pending > 0 ? '#f59e0b' : 'rgba(255,255,255,0.25)' },
            ].map(s => (
              <button
                key={s.label}
                onClick={() => navigate('/my-assignments')}
                className="group flex items-center gap-2.5 pl-3 pr-4 h-9 rounded-full transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] bg-white/70 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.07] backdrop-blur-md"
              >
                <span className="h-1.5 w-1.5 rounded-full dark:hidden" style={{ background: s.dot, boxShadow: `0 0 8px ${s.dot}` }} />
                <span className="h-1.5 w-1.5 rounded-full hidden dark:block" style={{ background: s.dotDark, boxShadow: `0 0 8px ${s.dotDark}` }} />
                <span className="text-[14px] font-bold tabular-nums text-gray-900 dark:text-white" style={{ letterSpacing: '-0.02em' }}>{s.value}</span>
                <span className="text-[11px] font-medium text-gray-500 dark:text-white/45 tracking-tight">{s.label}</span>
              </button>
            ))}
          </div>
        </motion.section>

        {/* ── 02 · Verse ── */}
        <motion.section variants={item}>
          <Card className="p-7 sm:p-9">
            <SectionLabel index="02">Daily Verse</SectionLabel>
            <div className="relative pl-5 sm:pl-7">
            <div className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full" style={{ background: 'linear-gradient(180deg, rgba(34,197,94,0.7), rgba(34,197,94,0.05))' }} />
            <p
              className="text-[20px] sm:text-[26px] lg:text-[30px] font-light leading-[1.35] text-gray-800 dark:text-white/85"
              style={{ letterSpacing: '-0.025em', fontFeatureSettings: '"ss01", "kern"' }}
            >
              "{todayVerse.text}"
            </p>
            <p className="mt-4 text-[11px] font-mono uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400/70">
              — {todayVerse.ref}
            </p>
            </div>
          </Card>
        </motion.section>

        {/* ── 03 · Cinematic Next Service ── */}
        {nextAssignment?.events && (
          <motion.section variants={item}>
            <SectionLabel index="03">Your Next Service</SectionLabel>
            <button
              onClick={() => navigate(`/events/${nextAssignment.event_id}`)}
              className="group w-full text-left"
            >
              <div
                className={`relative overflow-hidden rounded-3xl p-6 sm:p-8 transition-all duration-500 group-hover:-translate-y-1 border ${
                  nextAssignment.status === 'confirmed'
                    ? 'border-emerald-200 dark:border-emerald-500/22'
                    : 'border-amber-200 dark:border-amber-500/22'
                }`}
                style={{
                  background: nextAssignment.status === 'confirmed'
                    ? 'linear-gradient(135deg, rgba(236,253,245,1) 0%, rgba(255,255,255,0.98) 45%, rgba(209,250,229,0.9) 100%)'
                    : 'linear-gradient(135deg, rgba(255,251,235,1) 0%, rgba(255,255,255,0.98) 45%, rgba(254,243,199,0.92) 100%)',
                  boxShadow: nextAssignment.status === 'confirmed'
                    ? '0 28px 60px -24px rgba(16,185,129,0.48), 0 0 0 1px rgba(16,185,129,0.04), 0 1px 2px rgba(15,23,42,0.05)'
                    : '0 28px 60px -24px rgba(245,158,11,0.5), 0 0 0 1px rgba(245,158,11,0.05), 0 1px 2px rgba(15,23,42,0.05)',
                }}
              >
                <div className="absolute inset-0 hidden dark:block pointer-events-none" style={{
                  background: nextAssignment.status === 'confirmed'
                    ? 'linear-gradient(135deg, #073b2d 0%, #06261d 48%, #03150f 100%)'
                    : 'linear-gradient(135deg, #3a2508 0%, #231706 48%, #120b03 100%)',
                }} />
                <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full pointer-events-none transition-opacity duration-500"
                  style={{
                    background: nextAssignment.status === 'confirmed'
                      ? 'radial-gradient(circle, rgba(34,197,94,0.18), transparent 70%)'
                      : 'radial-gradient(circle, rgba(245,158,11,0.2), transparent 70%)',
                    filter: 'blur(20px)', opacity: 0.7,
                  }}
                />
                <div className="absolute inset-0 pointer-events-none opacity-[0.05] dark:opacity-[0.04]" style={{
                  backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
                  backgroundSize: '32px 32px',
                }} />

                <div className="relative flex items-start justify-between gap-4 mb-6">
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${nextAssignment.status === 'confirmed' ? 'bg-emerald-400' : 'bg-amber-400'}`} style={{ boxShadow: '0 0 8px currentColor' }} />
                    <p className={`text-[10px] font-mono uppercase tracking-[0.22em] ${
                      nextAssignment.status === 'confirmed'
                        ? 'text-emerald-700/70 dark:text-white/55'
                        : 'text-amber-700/75 dark:text-white/55'
                    }`}>
                      {nextAssignment.status === 'confirmed' ? 'Confirmed' : 'Pending Confirmation'}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400 dark:text-white/30 transition-all duration-300 group-hover:translate-x-1 group-hover:text-gray-600 dark:group-hover:text-white/60" />
                </div>

                <div className="relative flex items-end gap-5 sm:gap-7">
                  <div className="shrink-0">
                    <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500 dark:text-white/40">{format(parseISO(nextAssignment.events.event_date), 'EEEE')}</p>
                    <p className="text-[68px] sm:text-[88px] font-black leading-[0.85] tracking-tighter mt-1 text-gray-950 dark:text-white" style={{
                      letterSpacing: '-0.06em',
                      textShadow: nextAssignment.status === 'confirmed'
                        ? '0 0 40px rgba(34,197,94,0.25)'
                        : '0 0 40px rgba(245,158,11,0.25)',
                    }}>
                      {format(parseISO(nextAssignment.events.event_date), 'd')}
                    </p>
                    <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-white/55 mt-1.5">{format(parseISO(nextAssignment.events.event_date), 'MMM yyyy')}</p>
                  </div>

                  <div className="flex-1 min-w-0 pb-2">
                    <p className="text-[18px] sm:text-[22px] font-bold text-gray-950 dark:text-white leading-tight tracking-tight truncate" style={{ letterSpacing: '-0.025em' }}>
                      {(() => { const parts = (nextAssignment.events.title || '').split(' '); if (parts.length > 1) { parts[parts.length - 1] = parts[parts.length - 1][0].toUpperCase() + '.'; } return parts.join(' '); })()}
                    </p>
                    {nextAssignment.events.start_time && (
                      <p className="text-[12px] text-gray-500 dark:text-white/50 mt-1 font-mono">
                        {formatTime12Hour(nextAssignment.events.start_time)}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap mt-3">
                      {nextAssignment.roles?.name && (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-md text-gray-700 dark:text-white bg-white/70 dark:bg-white/[0.1] border border-black/[0.06] dark:border-white/[0.08]">
                          {nextAssignment.roles.name}
                        </span>
                      )}
                      <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md border ${
                        nextAssignment.status === 'confirmed'
                          ? 'bg-emerald-100/80 dark:bg-emerald-500/[0.14] border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                          : 'bg-amber-100/80 dark:bg-amber-500/[0.14] border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300'
                      }`}>
                        {nextAssignment.status === 'confirmed' ? <><CheckCircle className="h-2.5 w-2.5" /> Confirmed</> : <><Clock className="h-2.5 w-2.5" /> Pending</>}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </button>
          </motion.section>
        )}

        {/* ── 04 · Leadership Quick Access ── */}
        {isLeader && (
          <motion.section variants={item}>
            <Card className="p-5 sm:p-6">
              <SectionLabel index="04">
                <span className="flex items-center gap-1.5"><Shield className="h-3 w-3" /> Leadership</span>
              </SectionLabel>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {[
                  { label: 'Overview', icon: LayoutDashboard, path: '/leadership/overview', badge: 0 },
                  { label: 'Manage Team', icon: Users, path: '/leadership/team', badge: 0 },
                  { label: 'Leave Requests', icon: ClipboardCheck, path: '/leadership/leave', badge: pendingLeaveCount },
                  { label: 'Setlist Reviews', icon: ListChecks, path: '/leadership/setlists', badge: pendingSetlists.length },
                  { label: 'Unavailable', icon: UserX, path: '/unavailable-members', badge: unavailableMembers.length },
                  ...(isProductionDirector ? [{ label: 'Discipline', icon: Shield, path: '/discipline', badge: 0 }] : []),
                ].map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      onClick={() => navigate(action.path)}
                      className="group relative flex flex-col items-center justify-center gap-2.5 px-3 py-4 rounded-2xl bg-gray-50/70 dark:bg-white/[0.025] border border-gray-200/70 dark:border-white/[0.05] hover:bg-white dark:hover:bg-white/[0.05] hover:border-emerald-300 dark:hover:border-emerald-500/30 hover:-translate-y-0.5 transition-all duration-200"
                    >
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-emerald-50 dark:bg-emerald-500/[0.1] text-emerald-600 dark:text-emerald-400 transition-transform group-hover:scale-105">
                        <Icon className="h-[18px] w-[18px]" />
                      </div>
                      <span className="text-[12px] font-semibold text-gray-700 dark:text-white/80 text-center leading-tight" style={{ letterSpacing: '-0.01em' }}>
                        {action.label}
                      </span>
                      {action.badge > 0 && (
                        <span
                          className="absolute top-2 right-2 flex h-5 min-w-5 items-center justify-center rounded-full border border-amber-300/60 bg-amber-400 px-1 text-[10px] font-black leading-none text-amber-950 shadow-[0_6px_14px_-6px_rgba(245,158,11,0.8)] ring-2 ring-white/90 dark:border-amber-300/30 dark:bg-amber-400/15 dark:text-amber-200 dark:shadow-[0_0_16px_rgba(245,158,11,0.22)] dark:ring-[#18181a]"
                        >
                          {action.badge > 9 ? '9+' : action.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </Card>
          </motion.section>
        )}

        {/* ── 05 · Events + Assignments + Announcements ── */}
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3 lg:gap-6">

          <motion.section variants={item}>
            <Card className="p-5 sm:p-6 h-full">
            <SectionLabel
              index="05"
              action={
                <button onClick={() => navigate('/events')} className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400/80 hover:text-emerald-500 dark:hover:text-emerald-300 flex items-center gap-1 transition-colors">
                  All <ArrowUpRight className="h-3 w-3" />
                </button>
              }
            >
              <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Upcoming Events</span>
            </SectionLabel>

            {upcomingEvents.length === 0 ? (
              <p className="text-[13px] text-gray-400 dark:text-white/30 py-6">No upcoming events.</p>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-white/[0.05]">
                {upcomingEvents.slice(0, 3).map(event => (
                  <button
                    key={event.id}
                    onClick={() => navigate(`/events/${event.id}`)}
                    className="group flex items-center gap-3.5 py-3.5 w-full text-left transition-all duration-200 hover:pl-1"
                  >
                    <DateChip date={event.event_date} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-gray-900 dark:text-white/90 truncate leading-tight tracking-tight">{event.title}</p>
                      <p className="text-[11px] text-gray-500 dark:text-white/40 mt-0.5 font-mono">
                        {event.event_type}{event.start_time && ` · ${formatTime12Hour(event.start_time)}`}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300 dark:text-white/15 shrink-0 transition-all group-hover:translate-x-0.5 group-hover:text-gray-500 dark:group-hover:text-white/40" />
                  </button>
                ))}
              </div>
            )}
            </Card>
          </motion.section>

          <motion.section variants={item}>
            <Card className="p-5 sm:p-6 h-full">
            <SectionLabel
              index="06"
              action={
                <button onClick={() => navigate('/my-assignments')} className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400/80 hover:text-emerald-500 dark:hover:text-emerald-300 flex items-center gap-1 transition-colors">
                  All <ArrowUpRight className="h-3 w-3" />
                </button>
              }
            >
              <span className="flex items-center gap-1.5"><Music className="h-3 w-3" /> My Assignments</span>
            </SectionLabel>

            {myAssignments.length === 0 ? (
              <p className="text-[13px] text-gray-400 dark:text-white/30 py-6">No current assignments.</p>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-white/[0.05]">
                {myAssignments.slice(0, 3).map(a => (
                  <button
                    key={a.id}
                    onClick={() => navigate(`/events/${a.event_id}`)}
                    className="group flex items-center gap-3.5 py-3.5 w-full text-left transition-all duration-200 hover:pl-1"
                  >
                    <DateChip date={a.events?.event_date ?? null} dim={a.status === 'declined'} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-gray-900 dark:text-white/90 truncate leading-tight tracking-tight">{a.events?.title}</p>
                      <p className="text-[11px] text-gray-500 dark:text-white/40 mt-0.5 font-mono">
                        {a.roles?.name}{a.events?.start_time && ` · ${formatTime12Hour(a.events.start_time)}`}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md shrink-0 border ${
                      a.status === 'confirmed' ? 'bg-emerald-50 dark:bg-emerald-500/[0.12] text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/25' :
                      a.status === 'declined' ? 'bg-red-50 dark:bg-red-500/[0.12] text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/25' :
                      'bg-amber-50 dark:bg-amber-500/[0.12] text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/25'
                    }`}>
                      {a.status === 'confirmed' ? 'Confirmed' : a.status === 'declined' ? 'Declined' : 'Pending'}
                    </span>
                  </button>
                ))}
              </div>
            )}
            </Card>
          </motion.section>

        {/* ── 07 · Announcements ── */}
        {recentAnnouncements.length > 0 && (
          <motion.section variants={item} className="lg:col-span-2 xl:col-span-1">
            <Card className="p-5 sm:p-6 h-full">
            <SectionLabel
              index="07"
              action={
                <button onClick={() => navigate('/announcements')} className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400/80 hover:text-emerald-500 dark:hover:text-emerald-300 flex items-center gap-1 transition-colors">
                  All <ArrowUpRight className="h-3 w-3" />
                </button>
              }
            >
              <span className="flex items-center gap-1.5"><Megaphone className="h-3 w-3" /> Announcements</span>
            </SectionLabel>

            <div className="divide-y divide-gray-200 dark:divide-white/[0.05]">
              {recentAnnouncements.map(a => {
                const blocks = (a as Announcement & { content_blocks?: { type: string; content: string }[] }).content_blocks;
                const hasPhotos = blocks?.some(b => b.type === 'image');
                const previewText = blocks?.length ? blocks.find(b => b.type === 'text')?.content || '' : a.content;
                return (
                  <button
                    key={a.id}
                    onClick={() => navigate(`/announcements/${a.id}`)}
                    className="group flex items-start gap-4 py-4 w-full text-left transition-all duration-200 hover:pl-1"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[14px] font-semibold text-gray-900 dark:text-white/90 truncate leading-tight tracking-tight">{a.title}</p>
                        {a.priority === 'urgent' && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 bg-red-50 dark:bg-red-500/[0.14] text-red-600 dark:text-red-300 border border-red-200 dark:border-red-500/25">Urgent</span>
                        )}
                        {hasPhotos && <ImageIcon className="h-3 w-3 text-gray-400 dark:text-white/30 shrink-0" />}
                      </div>
                      {previewText && <p className="text-[12px] text-gray-500 dark:text-white/45 line-clamp-1 leading-relaxed">{previewText}</p>}
                      <p className="text-[10px] font-mono text-gray-400 dark:text-white/25 mt-1.5 tracking-wide">
                        {a.profiles?.first_name} {a.profiles?.last_name} · {format(parseISO(a.created_at), 'MMM d')}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300 dark:text-white/15 shrink-0 mt-1 transition-all group-hover:translate-x-0.5 group-hover:text-gray-500 dark:group-hover:text-white/40" />
                  </button>
                );
              })}
            </div>
            </Card>
          </motion.section>
        )}
        </div>

      </motion.div>

      {/* Modals — unchanged */}
      <Modal open={!!selectedUnavailability} onClose={() => setSelectedUnavailability(null)} title="Unavailability Details">
        {selectedUnavailability && (
          <>
            <div className="space-y-4">
              <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Team Member</label><p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedUnavailability.profiles?.first_name} {selectedUnavailability.profiles?.last_name}</p></div>
              <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Date</label><p className="text-sm text-gray-900 dark:text-white">{selectedUnavailability.leave_type === 'range' && selectedUnavailability.start_date && selectedUnavailability.end_date ? `${format(parseISO(selectedUnavailability.start_date), 'MMM d')} – ${format(parseISO(selectedUnavailability.end_date), 'MMMM d, yyyy')}` : selectedUnavailability.unavailable_date ? format(parseISO(selectedUnavailability.unavailable_date), 'EEEE, MMMM d, yyyy') : '—'}</p></div>
              <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Reason</label><p className="text-sm text-gray-700 dark:text-gray-300">{selectedUnavailability.reason || 'No reason provided'}</p></div>
              <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Status</label><span className="badge-green">{selectedUnavailability.status}</span></div>
              {selectedUnavailability.reviewed_at && <div><label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">Reviewed At</label><p className="text-sm text-gray-700 dark:text-gray-300">{format(parseISO(selectedUnavailability.reviewed_at), 'MMMM d, yyyy h:mm a')}</p></div>}
            </div>
            <div className="mt-6 flex gap-3 justify-end">
              {isProductionDirector ? (<><button onClick={() => setSelectedUnavailability(null)} className="btn-secondary">Close</button><button onClick={() => setShowDeleteConfirm(true)} className="btn-danger flex items-center gap-2"><Trash2 className="h-4 w-4" />Delete</button></>) : (<button onClick={() => setSelectedUnavailability(null)} className="btn-secondary">Close</button>)}
            </div>
          </>
        )}
      </Modal>

      <Modal open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete Request" size="sm">
        <p className="text-sm text-gray-700 dark:text-gray-300">Are you sure you want to delete this unavailability request? This action cannot be undone.</p>
        <div className="mt-6 flex gap-3 justify-end">
          <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary">Cancel</button>
          <button onClick={handleConfirmDelete} className="btn-danger">Delete</button>
        </div>
      </Modal>
    </div>
  );
}

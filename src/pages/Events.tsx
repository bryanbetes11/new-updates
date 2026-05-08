import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, startOfDay, subWeeks, previousSunday, addDays, subDays, differenceInDays, eachDayOfInterval } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { motion } from 'framer-motion';
import { Calendar, Plus, Search, ChevronRight, Filter, Users, Trash2, CalendarOff, LayoutGrid, List, AlertCircle, Clock, X, PartyPopper, Heart } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Modal } from '../components/Modal';
import { Select } from '../components/Select';
import { DatePicker } from '../components/DatePicker';
import { TimePicker } from '../components/TimePicker';
import { EventsSkeleton } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { CalendarGrid } from '../components/CalendarGrid';
import { formatTime12Hour } from '../lib/timeFormat';
import type { Event } from '../types';

const eventTypes = ['Sunday Service', 'Prayer Meeting', 'LGTF (Midweek)', 'Rehearsals', 'Online Devotion', 'Equipping', 'Revamp Session', 'Youth Recharge', 'Custom'];

interface AssignmentRow { user_id: string; role_id: string; }
interface CalendarEntry { type: 'birthday' | 'leave'; date: string; name: string; status?: string; }
interface SetlistInfo { status: string; created_at: string; submitted_at: string | null; }

const EVENT_TYPE_COLORS: Record<string, { lightBg: string; lightText: string; darkBg: string; darkText: string }> = {
  'Sunday Service':   { lightBg: 'rgba(37,99,235,0.10)',  lightText: '#1d4ed8', darkBg: 'rgba(37,99,235,0.18)',  darkText: '#93c5fd' },
  'Prayer Meeting':   { lightBg: 'rgba(124,58,237,0.10)', lightText: '#7c3aed', darkBg: 'rgba(124,58,237,0.18)', darkText: '#c4b5fd' },
  'LGTF (Midweek)':  { lightBg: 'rgba(20,184,166,0.10)', lightText: '#0f766e', darkBg: 'rgba(20,184,166,0.18)', darkText: '#5eead4' },
  'Rehearsals':       { lightBg: 'rgba(217,119,6,0.10)',  lightText: '#b45309', darkBg: 'rgba(217,119,6,0.18)',  darkText: '#fcd34d' },
  'Online Devotion':  { lightBg: 'rgba(219,39,119,0.10)', lightText: '#be185d', darkBg: 'rgba(219,39,119,0.18)', darkText: '#f9a8d4' },
  'Equipping':        { lightBg: 'rgba(22,163,74,0.10)',  lightText: '#15803d', darkBg: 'rgba(22,163,74,0.18)',  darkText: '#86efac' },
  'Revamp Session':   { lightBg: 'rgba(234,88,12,0.10)',  lightText: '#c2410c', darkBg: 'rgba(234,88,12,0.18)',  darkText: '#fdba74' },
  'Youth Recharge':   { lightBg: 'rgba(225,29,72,0.10)',  lightText: '#be123c', darkBg: 'rgba(225,29,72,0.18)',  darkText: '#fda4af' },
};

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.42, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

function EventTypeBadge({ type }: { type: string }) {
  const colors = EVENT_TYPE_COLORS[type];
  if (!colors) return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-white/[0.08] text-gray-500 dark:text-white/40">
      {type}
    </span>
  );
  return (
    <>
      <span className="dark:hidden text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: colors.lightBg, color: colors.lightText }}>{type}</span>
      <span className="hidden dark:inline text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: colors.darkBg, color: colors.darkText }}>{type}</span>
    </>
  );
}

function EventCard({ event, calendarEntries, songLeaderMap, setlistInfoMap, onEventClick, isPast }: {
  event: Event; calendarEntries: CalendarEntry[]; songLeaderMap?: Record<string, string>; setlistInfoMap?: Record<string, SetlistInfo>; onEventClick: (id: string) => void; isPast?: boolean;
}) {
  const dayEntries = calendarEntries.filter(e => e.date === event.event_date && e.type === 'leave');
  const songLeader = songLeaderMap?.[event.id];
  const setlistInfo = setlistInfoMap?.[event.id];
  const hasApprovedSetlist = setlistInfo?.status === 'approved';
  const now = new Date();
  const proposalDueDate = event.proposal_due_date ? parseISO(event.proposal_due_date) : null;
  const daysUntilDue = proposalDueDate ? differenceInDays(proposalDueDate, now) : null;
  const isDueSoon = daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 3;
  const isOverdue = daysUntilDue !== null && daysUntilDue < 0;
  const setlistSubmittedAt = setlistInfo?.submitted_at ? parseISO(setlistInfo.submitted_at) : (setlistInfo?.created_at ? parseISO(setlistInfo.created_at) : null);
  const wasSubmittedLate = hasApprovedSetlist && proposalDueDate && setlistSubmittedAt && setlistSubmittedAt > proposalDueDate;
  const wasSubmittedOnTime = hasApprovedSetlist && proposalDueDate && setlistSubmittedAt && setlistSubmittedAt <= proposalDueDate;
  const daysOverdueWhenSubmitted = wasSubmittedLate && proposalDueDate && setlistSubmittedAt
    ? Math.ceil((setlistSubmittedAt.getTime() - proposalDueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

  // Visual urgency states (only when proposal is missing)
  const showOverdueStyle = isOverdue && !hasApprovedSetlist && !isPast;
  const showDueSoonStyle = isDueSoon && !hasApprovedSetlist && !isPast;

  // Date chip gradient encodes urgency directly
  const chipGradient = isPast
    ? null
    : showOverdueStyle
    ? 'linear-gradient(145deg,#ef4444,#b91c1c)'
    : showDueSoonStyle
    ? 'linear-gradient(145deg,#f59e0b,#b45309)'
    : 'linear-gradient(145deg,#16a34a,#15803d)';

  const chipShadow = isPast
    ? undefined
    : showOverdueStyle
    ? '0 4px 14px rgba(220,38,38,0.45)'
    : showDueSoonStyle
    ? '0 4px 14px rgba(245,158,11,0.45)'
    : '0 3px 10px rgba(22,163,74,0.3)';

  // Card tint — subtle full-card wash matching urgency / status
  const cardTint = isPast
    ? undefined
    : showOverdueStyle
    ? 'linear-gradient(135deg, rgba(239,68,68,0.13), rgba(239,68,68,0.04) 45%, transparent 75%)'
    : showDueSoonStyle
    ? 'linear-gradient(135deg, rgba(245,158,11,0.13), rgba(245,158,11,0.04) 45%, transparent 75%)'
    : 'linear-gradient(135deg, rgba(34,197,94,0.09), rgba(34,197,94,0.025) 45%, transparent 75%)';

  return (
    <button
      onClick={() => onEventClick(event.id)}
      className="card-hover group relative w-full flex items-center gap-3.5 px-4 py-3.5 text-left overflow-hidden"
      style={{ borderRadius: '1.5rem', opacity: isPast ? 0.6 : 1, backgroundImage: cardTint }}
    >
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.05] dark:via-white/[0.09] to-transparent" />

      {/* Date chip — gradient encodes urgency */}
      <div
        className={`relative flex flex-col items-center justify-center h-[52px] w-11 rounded-xl shrink-0 ${isPast ? 'bg-gray-100 dark:bg-white/[0.05]' : ''}`}
        style={isPast ? {} : { background: chipGradient!, boxShadow: chipShadow }}
      >
        <span className={`text-[9px] font-black uppercase tracking-widest leading-none ${isPast ? 'text-gray-400 dark:text-white/25' : 'text-white/65'}`}>
          {format(parseISO(event.event_date), 'MMM')}
        </span>
        <span className={`text-[22px] font-black leading-none mt-0.5 ${isPast ? 'text-gray-500 dark:text-white/35' : 'text-white'}`} style={{ letterSpacing: '-0.04em' }}>
          {format(parseISO(event.event_date), 'd')}
        </span>
        <span className={`text-[8px] font-bold leading-none mt-0.5 ${isPast ? 'text-gray-400 dark:text-white/20' : 'text-white/50'}`}>
          {format(parseISO(event.event_date), 'EEE')}
        </span>
        {hasApprovedSetlist && !isPast && (
          <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full ring-2 ring-white dark:ring-[#1c1b1e]" style={{ background: '#22c55e' }} />
        )}
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[14px] font-bold leading-snug text-gray-900 dark:text-white" style={{ letterSpacing: '-0.015em' }}>
            {songLeader || event.title}
          </p>
          <EventTypeBadge type={event.event_type} />
          {showOverdueStyle && (
            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-lg bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400">
              <AlertCircle className="h-3 w-3" /> Overdue
            </span>
          )}
          {showDueSoonStyle && (
            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-3 w-3" /> Due in {daysUntilDue}d
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-1">
          <Clock className="h-3 w-3 shrink-0 text-gray-400 dark:text-white/25" />
          <span className="text-[12px] text-gray-500 dark:text-white/40">
            {formatTime12Hour(event.start_time || '')}{event.end_time && ` – ${formatTime12Hour(event.end_time)}`}
          </span>
        </div>

        {event.proposal_due_date && !isPast && (
          <p className={`text-[11px] mt-1 flex items-center gap-1 font-medium ${
            wasSubmittedOnTime || wasSubmittedLate ? 'text-emerald-600 dark:text-emerald-400' :
            isOverdue && !hasApprovedSetlist ? 'text-red-500 dark:text-red-400' :
            isDueSoon && !hasApprovedSetlist ? 'text-amber-600 dark:text-amber-400' :
            'text-gray-400 dark:text-white/25'
          }`}>
            <span className="font-semibold">Due:</span> {formatInTimeZone(parseISO(event.proposal_due_date), 'Asia/Manila', "MMM d 'at' h:mm a")}
            {wasSubmittedOnTime && ' ✓ On-time'}
            {wasSubmittedLate && ` (${daysOverdueWhenSubmitted}d late)`}
          </p>
        )}

        {dayEntries.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {dayEntries.map((entry, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-orange-50 dark:bg-orange-500/[0.15] text-orange-600 dark:text-orange-300">
                <CalendarOff className="h-3 w-3" />
                {entry.name} out
              </span>
            ))}
          </div>
        )}
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 text-gray-300 dark:text-white/20" />
    </button>
  );
}

function BirthdayCard({ name, date }: { name: string; date: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [wishing, setWishing] = useState(false);
  const [wished, setWished] = useState(false);
  const [announcementId, setAnnouncementId] = useState<string | null>(null);

  const firstName = name.split(' ')[0];
  const isToday = date === format(new Date(), 'yyyy-MM-dd');

  // On mount, check if a birthday announcement already exists today
  // and whether this user has already wished
  useEffect(() => {
    if (!isToday || !user) return;
    (async () => {
      const todayStart = `${date}T00:00:00`;
      const todayEnd = `${date}T23:59:59`;
      const { data } = await supabase
        .from('announcements')
        .select('id, announcement_reactions(user_id, emoji)')
        .like('title', `🎂 Happy Birthday, ${name}%`)
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd)
        .maybeSingle();
      if (data) {
        setAnnouncementId(data.id);
        const alreadyWished = (data.announcement_reactions as any[])?.some(
          r => r.user_id === user.id
        );
        if (alreadyWished) setWished(true);
      }
    })();
  }, [isToday, user, name, date]);

  const handleWish = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || wishing || wished) return;
    setWishing(true);

    if (!announcementId) {
      // First person to wish — create the shared birthday announcement
      const { data: newAnn, error } = await supabase
        .from('announcements')
        .insert({
          title: `🎂 Happy Birthday, ${name}!`,
          content: `🎉 Today is ${firstName}'s birthday! Wishing them all of God's blessings on their special day! 🙏`,
          priority: 'normal',
          created_by: user.id,
        })
        .select('id')
        .maybeSingle();
      if (error || !newAnn) { toast('error', 'Could not send birthday wish'); setWishing(false); return; }
      setAnnouncementId(newAnn.id);
    } else {
      // Announcement already exists — just add a 🎉 reaction
      await supabase.from('announcement_reactions').insert({
        announcement_id: announcementId,
        user_id: user.id,
        emoji: '🎉',
      });
    }

    setWishing(false);
    toast('success', `Birthday wish sent to ${firstName}! 🎉`);
    setWished(true);
  };

  return (
    <div
      className="relative flex items-center gap-4 px-4 py-4 overflow-hidden"
      style={{
        borderRadius: '1.5rem',
        background: 'linear-gradient(135deg, rgba(236,72,153,0.08) 0%, rgba(168,85,247,0.05) 60%, transparent 100%)',
        border: '1px solid rgba(236,72,153,0.2)',
        boxShadow: '0 1px 3px rgba(236,72,153,0.08), 0 4px 16px -8px rgba(236,72,153,0.12)',
      }}
    >
      {/* Subtle shimmer highlight */}
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-pink-300/30 to-transparent" />

      {/* Birthday icon chip */}
      <div
        className="relative flex flex-col items-center justify-center h-[52px] w-11 rounded-xl shrink-0"
        style={{ background: 'linear-gradient(145deg, #ec4899, #a855f7)', boxShadow: '0 3px 12px rgba(236,72,153,0.35)' }}
      >
        <span className="text-xl leading-none">🎂</span>
        <span className="text-[8px] font-black uppercase tracking-widest text-white/70 mt-0.5">
          {format(parseISO(date), 'MMM')}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[14px] font-bold leading-snug text-gray-900 dark:text-white" style={{ letterSpacing: '-0.015em' }}>
            {name}
          </p>
          {isToday ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-lg bg-pink-100 dark:bg-pink-500/20 text-pink-600 dark:text-pink-300">
              <PartyPopper className="h-3 w-3" /> Today!
            </span>
          ) : (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-pink-50 dark:bg-pink-500/[0.12] text-pink-500 dark:text-pink-300">
              Birthday
            </span>
          )}
        </div>
        <p className="text-[12px] text-gray-500 dark:text-white/40 mt-0.5 font-mono">
          {format(parseISO(date), 'EEEE, MMMM d')}
        </p>
      </div>

      {/* Greet button — only active on the birthday itself */}
      {isToday ? (
        <button
          onClick={handleWish}
          disabled={wishing || wished}
          className="shrink-0 inline-flex items-center gap-1.5 px-3.5 h-8 rounded-full text-[12px] font-semibold transition-all active:scale-95 disabled:opacity-60"
          style={wished
            ? { background: 'rgba(22,163,74,0.12)', color: '#16a34a', border: '1px solid rgba(22,163,74,0.25)' }
            : { background: 'linear-gradient(135deg, #ec4899, #a855f7)', color: '#fff', boxShadow: '0 3px 10px rgba(236,72,153,0.3)' }
          }
        >
          {wished ? (
            <><Heart className="h-3.5 w-3.5 fill-emerald-500 text-emerald-500" /> Wished!</>
          ) : wishing ? (
            '...'
          ) : (
            <><PartyPopper className="h-3.5 w-3.5" /> Greet</>
          )}
        </button>
      ) : (
        <div
          className="shrink-0 inline-flex items-center gap-1.5 px-3.5 h-8 rounded-full text-[12px] font-semibold cursor-not-allowed select-none"
          style={{ background: 'rgba(236,72,153,0.08)', color: 'rgba(236,72,153,0.4)', border: '1px solid rgba(236,72,153,0.15)' }}
          title={`Greetings open on ${format(parseISO(date), 'MMMM d')}`}
        >
          <PartyPopper className="h-3.5 w-3.5" />
          {format(parseISO(date), 'MMM d')}
        </div>
      )}
    </div>
  );
}

const itemAnim = { hidden: { opacity: 0, y: 10, filter: 'blur(4px)' }, show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number,number,number,number] } } };

function EventList({ events, calendarEntries, songLeaderMap, setlistInfoMap, onEventClick, showPast }: {
  events: Event[]; calendarEntries: CalendarEntry[]; songLeaderMap?: Record<string, string>; setlistInfoMap?: Record<string, SetlistInfo>; onEventClick: (id: string) => void; showPast?: boolean;
}) {
  const today = startOfDay(new Date());

  const displayEvents = showPast
    ? events.filter(e => parseISO(e.event_date) < today).sort((a, b) => b.event_date.localeCompare(a.event_date))
    : events.filter(e => parseISO(e.event_date) >= today).sort((a, b) => a.event_date.localeCompare(b.event_date));

  // Upcoming birthday entries (deduplicated, not shown in past view)
  const birthdayEntries = showPast ? [] : Array.from(
    new Map(
      calendarEntries
        .filter(e => e.type === 'birthday' && parseISO(e.date) >= today)
        .map(e => [`${e.name}-${e.date}`, e])
    ).values()
  );

  type ListItem =
    | { kind: 'event'; sortDate: string; event: Event }
    | { kind: 'birthday'; sortDate: string; entry: CalendarEntry };

  const merged: ListItem[] = [
    ...displayEvents.map(e => ({ kind: 'event' as const, sortDate: e.event_date, event: e })),
    ...birthdayEntries.map(e => ({ kind: 'birthday' as const, sortDate: e.date, entry: e })),
  ].sort((a, b) => a.sortDate.localeCompare(b.sortDate));

  if (merged.length === 0) return null;

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
      className="space-y-2.5"
    >
      {merged.map((item) => (
        <motion.div key={item.kind === 'event' ? item.event.id : `bday-${item.entry.name}-${item.entry.date}`} variants={itemAnim}>
          {item.kind === 'event' ? (
            <EventCard event={item.event} calendarEntries={calendarEntries} songLeaderMap={songLeaderMap} setlistInfoMap={setlistInfoMap} onEventClick={onEventClick} isPast={showPast} />
          ) : (
            <BirthdayCard name={item.entry.name} date={item.entry.date} />
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}

export function Events() {
  const { user, isLeader, roles } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [members, setMembers] = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  const [memberRoles, setMemberRoles] = useState<{ user_id: string; role_id: string }[]>([]);
  const [assignmentRows, setAssignmentRows] = useState<AssignmentRow[]>([]);
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>([]);
  const [songLeaderMap, setSongLeaderMap] = useState<Record<string, string>>({});
  const [setlistInfoMap, setSetlistInfoMap] = useState<Record<string, SetlistInfo>>({});
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    const s = localStorage.getItem('eventsViewMode'); return (s === 'grid' || s === 'list') ? s : 'grid';
  });
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>(() => {
    const s = localStorage.getItem('eventsActiveTab'); return (s === 'upcoming' || s === 'past') ? s : 'upcoming';
  });
  const [form, setForm] = useState({ title: '', event_date: '', start_time: '', end_time: '', event_type: '', description: '', song_leader_id: '', linked_event_id: '' });
  const [customName, setCustomName] = useState('');
  const [sundayServices, setSundayServices] = useState<Event[]>([]);

  const fetchEvents = async () => {
    const [eventsRes, membersRes, userRolesRes, birthdaysRes, leaveRes, songLeadersRes, setlistsRes, sundayServicesRes] = await Promise.all([
      supabase.from('events').select('*').order('event_date', { ascending: false }),
      supabase.from('profiles').select('id, first_name, last_name, birthday'),
      supabase.from('user_roles').select('user_id, role_id'),
      supabase.from('profiles').select('first_name, last_name, birthday').not('birthday', 'is', null),
      supabase.from('user_availability').select('leave_type, unavailable_date, start_date, end_date, status, profiles!user_availability_user_id_fkey(first_name, last_name)').eq('status', 'approved'),
      supabase.from('event_assignments').select('event_id, profiles(first_name, last_name, gender), roles!inner(name)').eq('roles.name', 'Song Leader'),
      supabase.from('setlists').select('event_id, status, created_at, submitted_at'),
      supabase.from('events').select('*').eq('event_type', 'Sunday Service').gte('event_date', new Date().toISOString().split('T')[0]).order('event_date'),
    ]);
    setEvents(eventsRes.data || []);
    setMembers(membersRes.data || []);
    setMemberRoles(userRolesRes.data || []);
    setSundayServices(sundayServicesRes.data || []);

    const slMap: Record<string, string> = {};
    (songLeadersRes.data || []).forEach((a: any) => {
      if (a.profiles) {
        const prefix = a.profiles.gender === 'male' ? 'Bro.' : a.profiles.gender === 'female' ? 'Sis.' : '';
        slMap[a.event_id] = prefix ? `${prefix} ${a.profiles.first_name}` : `${a.profiles.first_name} ${a.profiles.last_name}`;
      }
    });
    setSongLeaderMap(slMap);

    const setlistMap: Record<string, SetlistInfo> = {};
    (setlistsRes.data || []).forEach((s: any) => { setlistMap[s.event_id] = { status: s.status, created_at: s.created_at, submitted_at: s.submitted_at }; });
    setSetlistInfoMap(setlistMap);

    const entries: CalendarEntry[] = [];
    (birthdaysRes.data || []).forEach((p: any) => {
      if (p.birthday) {
        const thisYear = new Date().getFullYear();
        entries.push({ type: 'birthday', date: `${thisYear}-${p.birthday.slice(5)}`, name: `${p.first_name} ${p.last_name}` });
      }
    });
    (leaveRes.data || []).forEach((a: any) => {
      const name = `${a.profiles?.first_name} ${a.profiles?.last_name}`;
      if (a.leave_type === 'range' && a.start_date && a.end_date) {
        eachDayOfInterval({ start: parseISO(a.start_date), end: parseISO(a.end_date) }).forEach(day => {
          entries.push({ type: 'leave', date: format(day, 'yyyy-MM-dd'), name, status: a.status });
        });
      } else if (a.unavailable_date) {
        entries.push({ type: 'leave', date: a.unavailable_date, name, status: a.status });
      }
    });
    setCalendarEntries(entries);
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, []);
  useEffect(() => { localStorage.setItem('eventsViewMode', viewMode); }, [viewMode]);
  useEffect(() => { localStorage.setItem('eventsActiveTab', activeTab); }, [activeTab]);

  const addAssignmentRow = () => setAssignmentRows(prev => [...prev, { user_id: '', role_id: '' }]);

  const updateAssignmentRow = (index: number, field: keyof AssignmentRow, value: string) => {
    setAssignmentRows(prev => prev.map((row, i) => {
      if (i !== index) return row;
      if (field === 'role_id') return { ...row, role_id: value, user_id: '' };
      return { ...row, [field]: value };
    }));
  };

  const getMembersForRole = (roleId: string) => {
    if (!roleId) return members;
    const userIds = memberRoles.filter(ur => ur.role_id === roleId).map(ur => ur.user_id);
    return members.filter(m => userIds.includes(m.id));
  };

  const removeAssignmentRow = (index: number) => setAssignmentRows(prev => prev.filter((_, i) => i !== index));

  const calculateProposalDueDate = (eventDate: string, eventType: string): string | null => {
    if (!eventDate) return null;
    const date = parseISO(eventDate);
    if (eventType === 'Sunday Service') return `${format(subWeeks(date, 3), 'yyyy-MM-dd')}T15:59:00Z`;
    if (eventType === 'LGTF (Midweek)' || eventType === 'Prayer Meeting') {
      let sunday = previousSunday(date);
      if (sunday.getTime() === date.getTime()) sunday = addDays(sunday, -7);
      return `${format(sunday, 'yyyy-MM-dd')}T15:59:00Z`;
    }
    if (eventType === 'Youth Recharge') return `${format(subDays(date, 7), 'yyyy-MM-dd')}T15:59:00Z`;
    return null;
  };

  const getDefaultTimes = (eventType: string) => {
    const map: Record<string, { start: string; end: string }> = {
      'Sunday Service': { start: '07:30', end: '11:30' },
      'LGTF (Midweek)': { start: '19:30', end: '21:00' },
      'Prayer Meeting': { start: '18:30', end: '19:30' },
      'Online Devotion': { start: '21:00', end: '22:00' },
      'Equipping': { start: '19:30', end: '21:00' },
      'Youth Recharge': { start: '16:00', end: '18:00' },
    };
    return map[eventType] || { start: '', end: '' };
  };

  const handleEventTypeChange = (newType: string) => {
    const times = getDefaultTimes(newType);
    setForm(prev => ({ ...prev, event_type: newType, start_time: times.start, end_time: times.end, song_leader_id: '', linked_event_id: '' }));
  };

  const handleDateChange = (newDate: string) => setForm(prev => ({ ...prev, event_date: newDate }));

  const getSongLeaders = () => {
    const r = roles.find(r => r.name === 'Song Leader');
    if (!r) return [];
    const ids = memberRoles.filter(ur => ur.role_id === r.id).map(ur => ur.user_id);
    return members.filter(m => ids.includes(m.id));
  };

  const generateEventTitle = async (): Promise<string> => {
    if (form.event_type === 'Custom') return customName.trim() || 'Custom Event';
    if (form.song_leader_id.trim()) {
      const sl = members.find(m => m.id === form.song_leader_id);
      if (sl) {
        const { data: p } = await supabase.from('profiles').select('gender').eq('id', form.song_leader_id).maybeSingle();
        const prefix = p?.gender === 'male' ? 'Bro.' : p?.gender === 'female' ? 'Sis.' : '';
        return prefix ? `${prefix} ${sl.first_name} ${sl.last_name}` : `${sl.first_name} ${sl.last_name}`;
      }
    }
    return form.event_type;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.event_type) { toast('error', 'Please select an event type'); return; }
    setCreating(true);
    const title = await generateEventTitle();
    const { data: newEvent, error } = await supabase.from('events').insert({
      title, event_date: form.event_date, start_time: form.start_time || null, end_time: form.end_time || null,
      event_type: form.event_type, description: form.description || null, created_by: user.id,
      proposal_due_date: calculateProposalDueDate(form.event_date, form.event_type),
      song_leader_id: form.song_leader_id || null, linked_event_id: form.linked_event_id || null,
    }).select('id').maybeSingle();
    if (error || !newEvent) { toast('error', 'Failed to create event'); setCreating(false); return; }

    const validAssignments = assignmentRows.filter(a => a.user_id && a.role_id);
    if (form.song_leader_id) {
      const slRole = roles.find(r => r.name === 'Song Leader');
      if (slRole) validAssignments.push({ user_id: form.song_leader_id, role_id: slRole.id });
    }
    if (validAssignments.length > 0) await supabase.from('event_assignments').insert(validAssignments.map(a => ({ event_id: newEvent.id, user_id: a.user_id, role_id: a.role_id })));

    if (form.event_type === 'Rehearsals' && form.linked_event_id && validAssignments.length > 0) {
      const { data: existing } = await supabase.from('event_assignments').select('user_id, role_id').eq('event_id', form.linked_event_id);
      const existingSet = new Set((existing || []).map(a => `${a.user_id}-${a.role_id}`));
      const newOnes = validAssignments.filter(a => !existingSet.has(`${a.user_id}-${a.role_id}`));
      if (newOnes.length > 0) await supabase.from('event_assignments').insert(newOnes.map(a => ({ event_id: form.linked_event_id, user_id: a.user_id, role_id: a.role_id })));
    }

    setCreating(false);
    toast('success', 'Event created');
    setShowCreate(false);
    setForm({ title: '', event_date: '', start_time: '', end_time: '', event_type: '', description: '', song_leader_id: '', linked_event_id: '' });
    setCustomName('');
    setAssignmentRows([]);
    fetchEvents();
  };

  const handleEventDateChange = async (eventId: string, newDate: string) => {
    const { error } = await supabase.from('events').update({ event_date: newDate }).eq('id', eventId);
    if (error) { toast('error', 'Failed to move event'); return; }
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, event_date: newDate } : e));
    toast('success', 'Event moved');
  };

  const today = startOfDay(new Date());
  const upcomingEvents = events.filter(e => parseISO(e.event_date) >= today);
  const pastEvents = events.filter(e => parseISO(e.event_date) < today);

  const filtered = events.filter(e => {
    const matchSearch = !search || e.title.toLowerCase().includes(search.toLowerCase());
    const matchType = !typeFilter || e.event_type === typeFilter;
    const matchTab = activeTab === 'upcoming' ? parseISO(e.event_date) >= today : parseISO(e.event_date) < today;
    return matchSearch && matchType && matchTab;
  });

  if (loading) return <div className="page-container"><EventsSkeleton /></div>;

  return (
    <div className="page-container page-bottom-pad">
      <div className="max-w-5xl mx-auto px-4 sm:px-5 lg:px-6 pt-6 sm:pt-8 pb-0 space-y-4">

        {/* ── Page Header ── */}
        <motion.div {...fadeUp(0)} className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="relative shrink-0">
              <div
                className="absolute inset-0 rounded-2xl"
                style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.35), transparent 70%)', filter: 'blur(10px)', transform: 'scale(1.5)' }}
              />
              <div
                className="relative h-11 w-11 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(145deg, #16a34a, #15803d)', boxShadow: '0 4px 14px rgba(22,163,74,0.35)' }}
              >
                <Calendar className="h-5 w-5 text-white" />
              </div>
            </div>
            <div>
              <p className="text-[10px] font-mono font-medium uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400/80 mb-0.5">
                Schedule
              </p>
              <h1 className="text-[1.5rem] sm:text-[1.75rem] font-black text-gray-900 dark:text-white leading-tight" style={{ letterSpacing: '-0.03em' }}>
                Events.
              </h1>
            </div>
          </div>
          {isLeader && (
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex shrink-0 items-center gap-1.5 px-4 h-9 rounded-full text-[12px] font-semibold text-white transition-all active:scale-[0.97]"
              style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 4px 14px rgba(22,163,74,0.35)' }}
            >
              <Plus className="h-3.5 w-3.5" /> New Event
            </button>
          )}
        </motion.div>

        {/* ── Tab Switcher ── */}
        <motion.div
          {...fadeUp(0.05)}
          className="flex gap-1 p-1 rounded-2xl"
          style={{ background: 'rgba(0,0,0,0.04)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)' }}
        >
          {(['upcoming', 'past'] as const).map(tab => {
            const active = activeTab === tab;
            const count = tab === 'upcoming' ? upcomingEvents.length : pastEvents.length;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold transition-all duration-200 ${
                  active
                    ? 'bg-white dark:bg-white/[0.06] shadow-sm ring-1 ring-black/[0.06] dark:ring-white/[0.09] text-gray-900 dark:text-white'
                    : 'text-gray-400 dark:text-white/35 hover:bg-white/50 dark:hover:bg-white/[0.04]'
                }`}
              >
                {tab === 'upcoming' ? 'Upcoming' : 'Past Events'}
                {count > 0 && (
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-bold ${
                    active && tab === 'upcoming'
                      ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                      : 'bg-black/[0.06] dark:bg-white/[0.08] text-gray-500 dark:text-white/35'
                  }`}>{count}</span>
                )}
              </button>
            );
          })}
        </motion.div>

        {/* ── Search + Filter ── */}
        <motion.div {...fadeUp(0.08)} className="hidden sm:flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400 dark:text-white/25" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search events…"
              className="w-full h-10 pl-10 pr-10 rounded-2xl text-[13px] bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 dark:focus:border-emerald-500/50 transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/30 hover:text-gray-600 transition-colors">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select
            value={typeFilter}
            onChange={setTypeFilter}
            options={[{ value: '', label: 'All Types' }, ...eventTypes.map(t => ({ value: t, label: t }))]}
            placeholder="All Types"
            className="sm:w-48"
            icon={<Filter className="h-4 w-4" />}
          />
          <div className="hidden lg:flex gap-1 p-1 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.07]">
            {(['grid', 'list'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`p-2 rounded-lg transition-all ${viewMode === mode ? 'bg-white dark:bg-white/[0.1] text-gray-900 dark:text-white shadow-sm' : 'text-gray-400 dark:text-white/30'}`}
              >
                {mode === 'grid' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-5 lg:px-6 pt-4">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Calendar className="h-8 w-8" />}
            title="No events found"
            description={search || typeFilter ? 'Try adjusting your search or filter.' : 'Create your first event to get started.'}
            action={isLeader ? <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="h-4 w-4" /> Create Event</button> : undefined}
          />
        ) : (
          <>
            <motion.div {...fadeUp(0.1)} className="hidden lg:block">
              {viewMode === 'grid' ? (
                <CalendarGrid events={filtered} calendarEntries={calendarEntries} songLeaderMap={songLeaderMap} setlistInfoMap={setlistInfoMap} onEventClick={id => navigate(`/events/${id}`)} onCreateEvent={isLeader ? () => setShowCreate(true) : undefined} onEventDateChange={isLeader ? handleEventDateChange : undefined} />
              ) : (
                <EventList events={filtered} calendarEntries={calendarEntries} songLeaderMap={songLeaderMap} setlistInfoMap={setlistInfoMap} onEventClick={id => navigate(`/events/${id}`)} showPast={activeTab === 'past'} />
              )}
            </motion.div>
            <motion.div {...fadeUp(0.1)} className="lg:hidden">
              <EventList events={filtered} calendarEntries={calendarEntries} songLeaderMap={songLeaderMap} setlistInfoMap={setlistInfoMap} onEventClick={id => navigate(`/events/${id}`)} showPast={activeTab === 'past'} />
            </motion.div>
          </>
        )}
      </div>

      {/* ── Create Modal ── */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setAssignmentRows([]); setCustomName(''); }} title="Create Event" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Type</label>
            <Select value={form.event_type} onChange={handleEventTypeChange} options={eventTypes.map(t => ({ value: t, label: t }))} placeholder="Select type" />
          </div>

          {form.event_type === 'Custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Event Name</label>
              <input
                type="text"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                placeholder="Enter event name"
                className="input-field"
                required
              />
            </div>
          )}

          {['Sunday Service', 'LGTF (Midweek)', 'Prayer Meeting', 'Youth Recharge'].includes(form.event_type) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Song Leader</label>
              <Select value={form.song_leader_id} onChange={v => setForm({ ...form, song_leader_id: v })} options={getSongLeaders().map(m => ({ value: m.id, label: `${m.first_name} ${m.last_name}` }))} placeholder="Select song leader" />
            </div>
          )}

          {form.event_type === 'Rehearsals' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">For Sunday Service</label>
              <Select value={form.linked_event_id} onChange={async (v) => {
                setForm({ ...form, linked_event_id: v });
                if (v) {
                  const { data: la } = await supabase.from('event_assignments').select('user_id, role_id, roles(name, is_leadership)').eq('event_id', v);
                  if (la && la.length > 0) setAssignmentRows(la.filter((a: any) => !a.roles?.is_leadership && a.roles?.name !== 'Song Leader').map((a: any) => ({ user_id: a.user_id, role_id: a.role_id })));
                } else { setAssignmentRows([]); }
              }} options={sundayServices.map(e => ({ value: e.id, label: `${format(parseISO(e.event_date), 'MMM d, yyyy')} - ${e.title}` }))} placeholder="Select Sunday Service" />
              {form.linked_event_id && assignmentRows.length > 0 && <p className="text-xs text-blue-600 dark:text-blue-400 mt-1.5">Team assignments auto-filled from the linked Sunday Service.</p>}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Date</label>
            <DatePicker value={form.event_date} onChange={handleDateChange} required />
          </div>

          {['Rehearsals', 'Revamp Session', 'Custom'].includes(form.event_type) ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Start Time</label>
                <TimePicker value={form.start_time} onChange={v => setForm({ ...form, start_time: v })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">End Time</label>
                <TimePicker value={form.end_time} onChange={v => setForm({ ...form, end_time: v })} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Start Time</label>
                <input type="text" value={form.start_time ? formatTime12Hour(form.start_time) : 'Auto-filled'} className="input-field bg-gray-50 dark:bg-gray-800" disabled />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">End Time</label>
                <input type="text" value={form.end_time ? formatTime12Hour(form.end_time) : 'Auto-filled'} className="input-field bg-gray-50 dark:bg-gray-800" disabled />
              </div>
            </div>
          )}

          {form.event_date && ['Sunday Service', 'LGTF (Midweek)', 'Prayer Meeting', 'Youth Recharge'].includes(form.event_type) && (
            <div className="p-3 rounded-xl" style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)' }}>
              <p className="text-xs" style={{ color: '#7dd3fc' }}>
                <span className="font-bold">Proposal Due:</span> {formatInTimeZone(parseISO(calculateProposalDueDate(form.event_date, form.event_type) || ''), 'Asia/Manila', "MMMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description (optional)</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input-field h-20 resize-none" />
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Users className="h-4 w-4" /> Team Assignments
              </label>
              <button type="button" onClick={addAssignmentRow} className="btn-ghost text-xs"><Plus className="h-3.5 w-3.5" /> Add Member</button>
            </div>
            {assignmentRows.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">No team members assigned yet.</p>
            ) : (
              <div className="space-y-2">
                {assignmentRows.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-1">
                      <Select value={row.role_id} onChange={v => updateAssignmentRow(i, 'role_id', v)} options={roles.filter(r => !r.is_leadership).map(r => ({ value: r.id, label: r.name }))} placeholder="Select role" />
                    </div>
                    <div className="flex-1">
                      <Select value={row.user_id} onChange={v => updateAssignmentRow(i, 'user_id', v)} options={getMembersForRole(row.role_id).map(m => ({ value: m.id, label: `${m.first_name} ${m.last_name}` }))} placeholder={row.role_id ? 'Select member' : 'Pick role first'} />
                    </div>
                    <button type="button" onClick={() => removeAssignmentRow(i)} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => { setShowCreate(false); setAssignmentRows([]); }} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={creating} className="btn-primary">{creating ? 'Creating...' : 'Create Event'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

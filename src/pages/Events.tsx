import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, startOfDay, subWeeks, previousSunday, addDays, differenceInDays, eachDayOfInterval } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { Calendar, Plus, Search, ChevronRight, Filter, Users, Trash2, Cake, CalendarOff, LayoutGrid, List, AlertCircle, Clock, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Modal } from '../components/Modal';
import { Select } from '../components/Select';
import { DatePicker } from '../components/DatePicker';
import { TimePicker } from '../components/TimePicker';
import { EventsSkeleton } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { sortRolesLeadershipFirst } from '../components/RoleBadge';
import { CalendarGrid } from '../components/CalendarGrid';
import { formatTime12Hour } from '../lib/timeFormat';
import type { Event } from '../types';

const eventTypes = ['Sunday Service', 'Prayer Meeting', 'LGTF (Midweek)', 'Rehearsals', 'Online Devotion', 'Equipping', 'Revamp Session', 'Youth Recharge', 'Custom'];

interface AssignmentRow { user_id: string; role_id: string; }
interface CalendarEntry { type: 'birthday' | 'leave'; date: string; name: string; status?: string; }
interface SetlistInfo { status: string; created_at: string; submitted_at: string | null; }

const EVENT_TYPE_COLORS: Record<string, string> = {
  'Sunday Service': 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
  'Prayer Meeting': 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
  'LGTF (Midweek)': 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
  'Rehearsals': 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  'Online Devotion': 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
  'Equipping': 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  'Revamp Session': 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  'Youth Recharge': 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300',
};

function EventCard({ event, calendarEntries, songLeaderMap, setlistInfoMap, onEventClick, isPast }: {
  event: Event; calendarEntries: CalendarEntry[]; songLeaderMap?: Record<string, string>; setlistInfoMap?: Record<string, SetlistInfo>; onEventClick: (id: string) => void; isPast?: boolean;
}) {
  const dayEntries = calendarEntries.filter(e => e.date === event.event_date);
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
  const eventTypeBadge = EVENT_TYPE_COLORS[event.event_type] ?? 'bg-gray-100 dark:bg-white/[0.07] text-gray-600 dark:text-gray-400';

  return (
    <button
      onClick={() => onEventClick(event.id)}
      className={`group w-full flex items-center gap-3.5 p-4 text-left rounded-2xl ring-1 transition-all duration-200 hover:-translate-y-px active:scale-[0.99] ${
        isPast
          ? 'bg-gray-50/60 dark:bg-white/[0.02] ring-black/[0.04] dark:ring-white/[0.04] opacity-70 hover:opacity-90'
          : 'bg-white dark:bg-[#1a1a1c] ring-black/[0.05] dark:ring-white/[0.06] hover:ring-black/[0.08] dark:hover:ring-white/[0.09]'
      }`}
      style={{ boxShadow: isPast ? 'none' : '0 1px 3px rgba(0,0,0,0.04)' }}
    >
      {/* Date chip */}
      <div className={`relative flex flex-col items-center justify-center h-14 w-12 rounded-xl shrink-0 ${
        isPast
          ? 'bg-gray-100 dark:bg-white/[0.05] text-gray-400 dark:text-gray-500'
          : 'bg-brand-600 text-white'
      }`}
        style={isPast ? {} : { boxShadow: '0 2px 6px rgba(0,0,0,0.12)' }}
      >
        <span className="text-[10px] font-black uppercase tracking-wider leading-none">{format(parseISO(event.event_date), 'MMM')}</span>
        <span className="text-[22px] font-black leading-none mt-0.5" style={{ letterSpacing: '-0.04em' }}>{format(parseISO(event.event_date), 'd')}</span>
        <span className="text-[9px] font-semibold leading-none mt-0.5 opacity-70">{format(parseISO(event.event_date), 'EEE')}</span>
        {(hasApprovedSetlist || (!hasApprovedSetlist && (isDueSoon || isOverdue))) && (
          <div className={`absolute -top-1 -right-1 h-3 w-3 rounded-full ring-2 ring-white dark:ring-gray-900 ${
            hasApprovedSetlist ? 'bg-green-500' :
            isOverdue ? 'bg-red-500' : 'bg-amber-500'
          }`} />
        )}
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2 flex-wrap">
          <p className={`text-sm font-bold leading-snug ${isPast ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`} style={{ letterSpacing: '-0.01em' }}>
            {songLeader || event.title}
          </p>
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${eventTypeBadge}`}>
            {event.event_type}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <Clock className="h-3 w-3 text-gray-400 shrink-0" />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formatTime12Hour(event.start_time || '')}{event.end_time && ` – ${formatTime12Hour(event.end_time)}`}
          </span>
        </div>
        {event.proposal_due_date && !isPast && (
          <p className={`text-[11px] mt-1 flex items-center gap-1 ${
            wasSubmittedOnTime ? 'text-green-600 dark:text-green-400' :
            wasSubmittedLate ? 'text-green-600 dark:text-green-400' :
            isOverdue && !hasApprovedSetlist ? 'text-red-600 dark:text-red-400' :
            isDueSoon && !hasApprovedSetlist ? 'text-amber-600 dark:text-amber-400' :
            'text-gray-400 dark:text-gray-500'
          }`}>
            {((isDueSoon || isOverdue) && !hasApprovedSetlist) && <AlertCircle className="h-3 w-3" />}
            <span className="font-semibold">Due:</span> {formatInTimeZone(parseISO(event.proposal_due_date), 'Asia/Manila', "MMM d \'at\' h:mm a")}
            {isOverdue && !hasApprovedSetlist && ' (Overdue)'}
            {isDueSoon && !hasApprovedSetlist && ` (${daysUntilDue}d)`}
            {wasSubmittedOnTime && ' (On-time)'}
            {wasSubmittedLate && ` (${daysOverdueWhenSubmitted}d late)`}
          </p>
        )}
        {dayEntries.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {dayEntries.map((entry, i) => (
              <span key={i} className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                entry.type === 'birthday' ? 'bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400' : 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'
              }`}>
                {entry.type === 'birthday' ? <Cake className="h-3 w-3" /> : <CalendarOff className="h-3 w-3" />}
                {entry.name} {entry.type === 'birthday' ? 'bday' : 'out'}
              </span>
            ))}
          </div>
        )}
      </div>
      <ChevronRight className={`h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 ${isPast ? 'text-gray-300 dark:text-gray-700' : 'text-gray-300 dark:text-gray-600'}`} />
    </button>
  );
}

function EventList({ events, calendarEntries, songLeaderMap, setlistInfoMap, onEventClick, showPast }: {
  events: Event[]; calendarEntries: CalendarEntry[]; songLeaderMap?: Record<string, string>; setlistInfoMap?: Record<string, SetlistInfo>; onEventClick: (id: string) => void; showPast?: boolean;
}) {
  const today = startOfDay(new Date());
  const displayEvents = showPast
    ? events.filter(e => parseISO(e.event_date) < today).sort((a, b) => b.event_date.localeCompare(a.event_date))
    : events.filter(e => parseISO(e.event_date) >= today).sort((a, b) => a.event_date.localeCompare(b.event_date));

  if (displayEvents.length === 0) return null;
  return (
    <div className="space-y-2">
      {displayEvents.map(event => (
        <EventCard key={event.id} event={event} calendarEntries={calendarEntries} songLeaderMap={songLeaderMap} setlistInfoMap={setlistInfoMap} onEventClick={onEventClick} isPast={showPast} />
      ))}
    </div>
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
      <div className="px-4 sm:px-5 lg:px-6 pt-5 sm:pt-7 pb-0 space-y-4">

        {/* ── Page Header ─────────────────────────────── */}
        <div className="flex items-start justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-2xl shrink-0" style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', boxShadow: '0 3px 12px rgba(37,99,235,0.3)' }}>
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-[1.375rem] font-black text-gray-900 dark:text-white leading-tight" style={{ letterSpacing: '-0.03em' }}>Events</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {upcomingEvents.length} upcoming · {pastEvents.length} past
              </p>
            </div>
          </div>
          {isLeader && (
            <button onClick={() => setShowCreate(true)} className="btn-primary shrink-0 text-sm">
              <Plus className="h-4 w-4" /> New Event
            </button>
          )}
        </div>

        {/* ── Tab Switcher ─────────────────────────────── */}
        <div
          className="flex gap-1 p-1 rounded-2xl animate-slide-up"
          style={{ animationDelay: '40ms', animationFillMode: 'both', background: 'rgba(0,0,0,0.04)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)' }}
        >
          {(['upcoming', 'past'] as const).map(tab => {
            const active = activeTab === tab;
            const count = tab === 'upcoming' ? upcomingEvents.length : pastEvents.length;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                  active
                    ? 'bg-white dark:bg-[#232325] shadow-sm ring-1 ring-black/[0.06] dark:ring-white/[0.09] text-gray-900 dark:text-white'
                    : 'text-gray-400 dark:text-gray-500 hover:bg-white/50 dark:hover:bg-white/[0.04]'
                }`}
              >
                {tab === 'upcoming' ? 'Upcoming' : 'Past Events'}
                {count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-lg font-bold ${
                    active ? (tab === 'upcoming' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400') : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-500'
                  }`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Search + Filter (desktop only) ─────────── */}
        <div className="hidden sm:flex items-center gap-2 animate-slide-up" style={{ animationDelay: '60ms', animationFillMode: 'both' }}>
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search events..." className="input-field pl-10 text-sm" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"><X className="h-4 w-4" /></button>}
          </div>
          <Select value={typeFilter} onChange={setTypeFilter} options={[{ value: '', label: 'All Types' }, ...eventTypes.map(t => ({ value: t, label: t }))]} placeholder="All Types" className="sm:w-48" icon={<Filter className="h-4 w-4" />} />
          <div className="hidden lg:flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(0,0,0,0.04)' }}>
            {(['grid', 'list'] as const).map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)} className={`p-2 rounded-lg transition-all ${viewMode === mode ? 'bg-white dark:bg-[#232325] shadow-sm text-gray-900 dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}>
                {mode === 'grid' ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────── */}
      <div className="px-4 sm:px-5 lg:px-6 pt-4">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Calendar className="h-8 w-8" />}
            title="No events found"
            description={search || typeFilter ? 'Try adjusting your search or filter.' : 'Create your first event to get started.'}
            action={isLeader ? <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="h-4 w-4" /> Create Event</button> : undefined}
          />
        ) : (
          <>
            <div className="hidden lg:block animate-slide-up" style={{ animationDelay: '100ms' }}>
              {viewMode === 'grid' ? (
                <CalendarGrid events={filtered} calendarEntries={calendarEntries} songLeaderMap={songLeaderMap} setlistInfoMap={setlistInfoMap} onEventClick={id => navigate(`/events/${id}`)} onCreateEvent={isLeader ? () => setShowCreate(true) : undefined} onEventDateChange={isLeader ? handleEventDateChange : undefined} />
              ) : (
                <EventList events={filtered} calendarEntries={calendarEntries} songLeaderMap={songLeaderMap} setlistInfoMap={setlistInfoMap} onEventClick={id => navigate(`/events/${id}`)} showPast={activeTab === 'past'} />
              )}
            </div>
            <div className="lg:hidden animate-slide-up" style={{ animationDelay: '100ms' }}>
              <EventList events={filtered} calendarEntries={calendarEntries} songLeaderMap={songLeaderMap} setlistInfoMap={setlistInfoMap} onEventClick={id => navigate(`/events/${id}`)} showPast={activeTab === 'past'} />
            </div>
          </>
        )}
      </div>

      {/* ── Create Modal ──────────────────────────────── */}
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

          {['Sunday Service', 'LGTF (Midweek)', 'Prayer Meeting'].includes(form.event_type) && (
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

          {form.event_date && ['Sunday Service', 'LGTF (Midweek)', 'Prayer Meeting'].includes(form.event_type) && (
            <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-900/20 ring-1 ring-sky-200 dark:ring-sky-800">
              <p className="text-xs text-sky-700 dark:text-sky-300">
                <span className="font-bold">Proposal Due:</span> {formatInTimeZone(parseISO(calculateProposalDueDate(form.event_date, form.event_type) || ''), 'Asia/Manila', "MMMM d, yyyy \'at\' h:mm a")}
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

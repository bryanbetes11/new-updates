import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, differenceInDays, differenceInHours, isPast, isToday, startOfDay } from 'date-fns';
import { motion } from 'framer-motion';
import { Bell, CheckCircle2, Clock, AlertTriangle, RefreshCw, Loader2, ListMusic, Pencil, X, Check, CalendarDays } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Avatar } from '../../components/Avatar';
import { LeadershipHeroCard } from '../../components/LeadershipHeroCard';

interface DeadlineEvent {
  id: string;
  title: string;
  event_date: string;
  proposal_due_date: string;
  song_leader: {
    id: string;
    first_name: string;
    last_name: string;
    nickname: string;
    avatar_url: string;
  } | null;
  setlist_status: string | null;
  reminder_count: number;
  last_reminder_at: string | null;
}

interface DeadlineEventRow {
  id: string;
  title: string;
  event_date: string;
  proposal_due_date: string;
  song_leader: DeadlineEvent['song_leader'] | DeadlineEvent['song_leader'][];
  setlists: Array<{ status: string | null }> | null;
}

type StatusFilter = 'all' | 'overdue' | 'due_today' | 'upcoming' | 'submitted';

function getDeadlineStatus(dueDate: string, setlistStatus: string | null): {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
} {
  if (setlistStatus === 'approved' || setlistStatus === 'pending_review') {
    return {
      label: setlistStatus === 'approved' ? 'Approved' : 'Submitted',
      color: 'text-emerald-700 dark:text-emerald-300',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    };
  }

  const due = parseISO(dueDate);
  if (isPast(due) && !isToday(due)) {
    return {
      label: 'Overdue',
      color: 'text-red-700 dark:text-red-300',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
    };
  }
  if (isToday(due)) {
    return {
      label: 'Due Today',
      color: 'text-amber-700 dark:text-amber-300',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
      icon: <Clock className="h-3.5 w-3.5" />,
    };
  }
  return {
    label: 'Upcoming',
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    icon: <Clock className="h-3.5 w-3.5" />,
  };
}

function getDaysLabel(dueDate: string, setlistStatus: string | null): { text: string; urgent: boolean } {
  if (setlistStatus === 'approved' || setlistStatus === 'pending_review') return { text: '', urgent: false };
  const due = parseISO(dueDate);
  const now = new Date();
  if (isToday(due)) {
    const hours = differenceInHours(due, now);
    if (hours <= 0) return { text: 'Due now', urgent: true };
    return { text: `${hours}h left`, urgent: true };
  }
  const days = differenceInDays(due, now);
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, urgent: true };
  if (days <= 3) return { text: `${days}d left`, urgent: true };
  return { text: `${days}d left`, urgent: false };
}

function getDaysLabelString(dueDate: string, setlistStatus: string | null): string {
  return getDaysLabel(dueDate, setlistStatus).text;
}

interface EditDueDatePopoverProps {
  event: DeadlineEvent;
  onSave: (eventId: string, newDate: string) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}

function EditDueDatePopover({ event, onSave, onClose, saving }: EditDueDatePopoverProps) {
  const due = parseISO(event.proposal_due_date);
  const [dateValue, setDateValue] = useState(format(due, "yyyy-MM-dd'T'HH:mm"));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute z-50 right-0 top-full mt-1.5 w-72 bg-white dark:bg-[#1c1c1e] rounded-xl shadow-xl ring-1 ring-black/10 dark:ring-white/10 p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
          Override Due Date
        </p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
        This changes the deadline for <span className="font-semibold text-gray-700 dark:text-gray-300">{event.title}</span> only.
      </p>
      <div>
        <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">New due date &amp; time</label>
        <input
          type="datetime-local"
          value={dateValue}
          onChange={e => setDateValue(e.target.value)}
          className="w-full text-xs px-2.5 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.04] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        />
      </div>
      <div className="flex gap-2 pt-0.5">
        <button
          onClick={onClose}
          disabled={saving}
          className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(event.id, dateValue)}
          disabled={saving || !dateValue}
          className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}

export function SetlistDeadlines() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [events, setEvents] = useState<DeadlineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingDueDateId, setSavingDueDateId] = useState<string | null>(null);

  const fetchDeadlines = useCallback(async () => {
    setLoading(true);
    const today = format(new Date(), 'yyyy-MM-dd');

    const { data: eventsData, error } = await supabase
      .from('events')
      .select(`
        id, title, event_date, proposal_due_date,
        song_leader:profiles!events_song_leader_id_fkey(id, first_name, last_name, nickname, avatar_url),
        setlists(status)
      `)
      .not('proposal_due_date', 'is', null)
      .gte('event_date', today)
      .order('proposal_due_date', { ascending: true });

    if (error) {
      toast('error', 'Failed to load setlist deadlines');
      setLoading(false);
      return;
    }

    const deadlineRows = (eventsData || []) as unknown as DeadlineEventRow[];
    const eventIds = deadlineRows.map((e) => e.id);
    const reminderCounts: Record<string, { count: number; last_sent: string | null }> = {};

    if (eventIds.length > 0) {
      const { data: reminders } = await supabase
        .from('setlist_reminders')
        .select('event_id, sent_at')
        .in('event_id', eventIds);

      if (reminders) {
        for (const r of reminders) {
          if (!reminderCounts[r.event_id]) {
            reminderCounts[r.event_id] = { count: 0, last_sent: null };
          }
          reminderCounts[r.event_id].count += 1;
          if (!reminderCounts[r.event_id].last_sent || r.sent_at > reminderCounts[r.event_id].last_sent!) {
            reminderCounts[r.event_id].last_sent = r.sent_at;
          }
        }
      }
    }

    const mapped: DeadlineEvent[] = deadlineRows.map((e) => {
      const statuses = (e.setlists || []).map((s) => s.status).filter(Boolean) as string[];
      let setlistStatus: string | null = null;
      if (statuses.includes('approved')) setlistStatus = 'approved';
      else if (statuses.includes('pending_review')) setlistStatus = 'pending_review';
      else if (statuses.length > 0) setlistStatus = statuses[0];

      return {
        id: e.id,
        title: e.title,
        event_date: e.event_date,
        proposal_due_date: e.proposal_due_date,
        song_leader: Array.isArray(e.song_leader) ? e.song_leader[0] || null : e.song_leader || null,
        setlist_status: setlistStatus,
        reminder_count: reminderCounts[e.id]?.count ?? 0,
        last_reminder_at: reminderCounts[e.id]?.last_sent ?? null,
      };
    });

    setEvents(mapped);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchDeadlines();
  }, [fetchDeadlines]);

  const handleSendReminder = async (event: DeadlineEvent) => {
    if (!event.song_leader) {
      toast('error', 'No song leader assigned to this event');
      return;
    }
    if (parseISO(event.event_date) < startOfDay(new Date())) {
      toast('error', 'This event is already done, so reminders are no longer sent.');
      return;
    }
    if (sendingId) return;

    if (event.last_reminder_at) {
      const minsAgo = (Date.now() - new Date(event.last_reminder_at).getTime()) / 60000;
      if (minsAgo < 10) {
        toast('error', 'A reminder was already sent recently. Please wait before sending another.');
        return;
      }
    }

    setSendingId(event.id);

    const dueLabel = getDaysLabelString(event.proposal_due_date, event.setlist_status);
    const eventDateLabel = format(parseISO(event.event_date), 'MMM d');
    const body = dueLabel.includes('overdue')
      ? `Your setlist for "${event.title}" (${eventDateLabel}) is ${dueLabel}. Open the event to submit it now.`
      : `Your setlist for "${event.title}" (${eventDateLabel}) is due soon (${dueLabel}). Open the event to get started.`;

    const { error: notifError } = await supabase.from('notifications').insert({
      user_id: event.song_leader.id,
      type: 'proposal_reminder',
      title: 'Setlist Reminder',
      body,
      data: { event_id: event.id, url: `/events/${event.id}` },
    });

    if (notifError) {
      toast('error', 'Failed to send notification');
      setSendingId(null);
      return;
    }

    const { error: trackError } = await supabase.from('setlist_reminders').insert({
      event_id: event.id,
      user_id: event.song_leader.id,
      sent_by: user!.id,
    });

    if (trackError) {
      toast('error', 'Reminder sent but failed to track count');
    } else {
      toast('success', `Reminder sent to ${event.song_leader.first_name}`);
      setEvents(prev => prev.map(e =>
        e.id === event.id
          ? { ...e, reminder_count: e.reminder_count + 1, last_reminder_at: new Date().toISOString() }
          : e
      ));
    }

    setSendingId(null);
  };

  const handleSaveDueDate = async (eventId: string, newDateLocal: string) => {
    if (!newDateLocal) return;
    setSavingDueDateId(eventId);

    const newIso = new Date(newDateLocal).toISOString();

    const { error } = await supabase
      .from('events')
      .update({ proposal_due_date: newIso })
      .eq('id', eventId);

    if (error) {
      toast('error', 'Failed to update due date');
    } else {
      toast('success', 'Due date updated');
      setEvents(prev => prev.map(e =>
        e.id === eventId ? { ...e, proposal_due_date: newIso } : e
      ));
      setEditingId(null);
    }

    setSavingDueDateId(null);
  };

  const isSubmitted = (e: DeadlineEvent) => e.setlist_status === 'approved' || e.setlist_status === 'pending_review';
  const isOverdue = (e: DeadlineEvent) => !isSubmitted(e) && isPast(parseISO(e.proposal_due_date)) && !isToday(parseISO(e.proposal_due_date));
  const isDueToday = (e: DeadlineEvent) => isToday(parseISO(e.proposal_due_date));
  const isUpcoming = (e: DeadlineEvent) => !isSubmitted(e) && !isPast(parseISO(e.proposal_due_date)) && !isToday(parseISO(e.proposal_due_date));

  const filteredEvents = events.filter(e => {
    if (filter === 'all') return true;
    if (filter === 'submitted') return isSubmitted(e);
    if (filter === 'overdue') return isOverdue(e);
    if (filter === 'due_today') return isDueToday(e);
    if (filter === 'upcoming') return isUpcoming(e);
    return true;
  });

  const countByStatus = {
    overdue: events.filter(isOverdue).length,
    due_today: events.filter(isDueToday).length,
    upcoming: events.filter(isUpcoming).length,
    submitted: events.filter(isSubmitted).length,
  };

  if (loading) {
    return (
      <div className="page-container page-bottom-pad touch-action-pan-y">
        <div className="relative max-w-2xl lg:max-w-6xl xl:max-w-[1560px] mx-auto pt-4 sm:pt-5 pb-6 px-4 sm:px-6 lg:px-8">
          <div className="py-10 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        </div>
      </div>
    );
  }

  const content = (
    <div className="touch-action-pan-y space-y-5 sm:space-y-6">
      <LeadershipHeroCard
        tone="emerald"
        icon={ListMusic}
        eyebrow="Setlist Oversight"
        title="Setlist Deadlines."
        description="Track proposal deadlines, follow overdue setlists, and send reminders before each service slips."
        action={(
          <button
            onClick={fetchDeadlines}
            className="inline-flex items-center justify-center h-11 w-11 rounded-full text-gray-600 dark:text-white/55 bg-white/78 dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.08] hover:bg-white dark:hover:bg-white/[0.08] active:scale-[0.95] transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        )}
      >
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-2.5"
        >
          {[
            { key: 'overdue', label: 'Overdue', count: countByStatus.overdue, dot: '#ef4444', tone: 'bg-red-50 dark:bg-red-500/[0.10] text-red-600 dark:text-red-400' },
            { key: 'due_today', label: 'Due Today', count: countByStatus.due_today, dot: '#f59e0b', tone: 'bg-amber-50 dark:bg-amber-500/[0.10] text-amber-600 dark:text-amber-400' },
            { key: 'upcoming', label: 'Upcoming', count: countByStatus.upcoming, dot: '#0ea5e9', tone: 'bg-sky-50 dark:bg-sky-500/[0.10] text-sky-600 dark:text-sky-400' },
            { key: 'submitted', label: 'Submitted', count: countByStatus.submitted, dot: '#22c55e', tone: 'bg-emerald-50 dark:bg-emerald-500/[0.10] text-emerald-600 dark:text-emerald-400' },
          ].map(stat => {
            const active = filter === stat.key;
            return (
              <button
                key={stat.key}
                onClick={() => setFilter(filter === stat.key as StatusFilter ? 'all' : stat.key as StatusFilter)}
                className={`touch-action-pan-y relative rounded-3xl p-4 text-left bg-white dark:bg-white/[0.025] border transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] overflow-hidden ${
                  active ? 'border-current/40' : 'border-gray-200/80 dark:border-white/[0.06]'
                } ${active ? stat.tone : ''}`}
                style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 4px 14px -8px rgba(15,23,42,0.08)' }}
              >
                <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.05] dark:via-white/[0.08] to-transparent" />
                <div className="flex items-center gap-1.5 mb-2.5">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: stat.dot, boxShadow: `0 0 6px ${stat.dot}` }} />
                  <span className={`text-[9px] font-bold uppercase tracking-[0.14em] leading-none ${active ? '' : 'text-gray-500 dark:text-white/45'}`}>{stat.label}</span>
                </div>
                <p className={`text-[26px] font-black leading-none tabular-nums ${active ? '' : 'text-gray-900 dark:text-white'}`} style={{ letterSpacing: '-0.04em' }}>{stat.count}</p>
              </button>
            );
          })}
        </motion.div>
      </LeadershipHeroCard>

      {filteredEvents.length === 0 ? (
        <div className="touch-action-pan-y rounded-3xl bg-white dark:bg-white/[0.025] border border-gray-200/80 dark:border-white/[0.06] p-12 text-center" style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px -12px rgba(15,23,42,0.10)' }}>
          <div
            className="relative h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(145deg,#16a34a,#15803d)', boxShadow: '0 4px 14px rgba(22,163,74,0.3)' }}
          >
            <ListMusic className="h-6 w-6 text-white" />
          </div>
          <p className="text-base font-bold text-gray-900 dark:text-white" style={{ letterSpacing: '-0.02em' }}>No deadlines found</p>
          <p className="text-sm text-gray-400 dark:text-white/40 mt-1">
            {filter === 'all' ? 'No upcoming events with setlist deadlines.' : 'No events match this filter.'}
          </p>
        </div>
      ) : (
        <div className="touch-action-pan-y space-y-2.5">
          {filteredEvents.map(event => {
            const status = getDeadlineStatus(event.proposal_due_date, event.setlist_status);
            const { text: daysText, urgent: daysUrgent } = getDaysLabel(event.proposal_due_date, event.setlist_status);
            const isSending = sendingId === event.id;
            const canSendReminder = !event.setlist_status || (event.setlist_status !== 'approved' && event.setlist_status !== 'pending_review');
            const recentlySent = event.last_reminder_at
              ? (Date.now() - new Date(event.last_reminder_at).getTime()) / 60000 < 10
              : false;
            const isEditOpen = editingId === event.id;
            const isSavingThis = savingDueDateId === event.id;
            const isOverdueEvent = isOverdue(event);
            const isDueTodayEvent = isDueToday(event);

            return (
              <div
                key={event.id}
                onClick={() => navigate(`/events/${event.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/events/${event.id}`); } }}
                className={`touch-action-pan-y relative rounded-3xl overflow-hidden bg-white dark:bg-white/[0.025] border p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${
                  isOverdueEvent ? 'border-red-200 dark:border-red-500/25' : isDueTodayEvent ? 'border-amber-200 dark:border-amber-500/25' : 'border-gray-200/80 dark:border-white/[0.06]'
                }`}
                style={{
                  boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px -12px rgba(15,23,42,0.10)',
                  backgroundImage: isOverdueEvent
                    ? 'linear-gradient(135deg, rgba(239,68,68,0.10), rgba(239,68,68,0.025) 50%, transparent 80%)'
                    : isDueTodayEvent
                    ? 'linear-gradient(135deg, rgba(245,158,11,0.10), rgba(245,158,11,0.025) 50%, transparent 80%)'
                    : undefined,
                }}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="shrink-0 mt-0.5">
                    {event.song_leader ? (
                      <Avatar
                        src={event.song_leader.avatar_url}
                        firstName={event.song_leader.first_name || '?'}
                        lastName={event.song_leader.last_name}
                        size="sm"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                        <ListMusic className="h-3.5 w-3.5 text-gray-400" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{event.title}</p>
                      <span className="text-[11px] text-gray-400 dark:text-gray-500">
                        Event {format(parseISO(event.event_date), 'MMM d')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {event.song_leader
                        ? `${event.song_leader.nickname || event.song_leader.first_name} ${event.song_leader.last_name}`
                        : <span className="text-amber-500">No song leader assigned</span>
                      }
                    </p>

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${status.bgColor} ${status.color}`}>
                        {status.icon}
                        {status.label}
                      </span>

                      {daysText && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          daysUrgent
                            ? isOverdueEvent
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                              : isDueTodayEvent
                                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                            : 'bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-400'
                        }`}>
                          {daysText}
                        </span>
                      )}

                      <span className={`inline-flex items-center gap-1 text-xs font-semibold ${
                        isOverdueEvent
                          ? 'text-red-600 dark:text-red-400'
                          : isDueTodayEvent
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        <CalendarDays className="h-3 w-3 shrink-0" />
                        {format(parseISO(event.proposal_due_date), 'MMM d, h:mm a')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 sm:shrink-0 relative">
                  {event.reminder_count > 0 && (
                    <div className="flex items-center gap-1">
                      <Bell className="h-3 w-3 text-gray-400" />
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {event.reminder_count}
                      </span>
                    </div>
                  )}

                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingId(isEditOpen ? null : event.id); }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
                    title="Override due date"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>

                  {canSendReminder && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleSendReminder(event); }}
                      disabled={isSending || recentlySent || !event.song_leader}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        recentlySent
                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                          : 'bg-brand-600 hover:bg-brand-700 text-white active:scale-95'
                      } disabled:opacity-60`}
                      title={recentlySent ? 'Recently sent — wait a moment' : 'Send reminder'}
                    >
                      {isSending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Bell className="h-3.5 w-3.5" />
                      )}
                      {isSending ? 'Sending...' : recentlySent ? 'Sent' : 'Remind'}
                    </button>
                  )}

                  {isEditOpen && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <EditDueDatePopover
                        event={event}
                        onSave={handleSaveDueDate}
                        onClose={() => setEditingId(null)}
                        saving={isSavingThis}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="page-container page-bottom-pad touch-action-pan-y">
      <div className="touch-action-pan-y relative max-w-2xl lg:max-w-6xl xl:max-w-[1560px] mx-auto pt-4 sm:pt-5 pb-6 px-4 sm:px-6 lg:px-8">
        {content}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { Check, X, Shield, MessageSquare, RefreshCw, ClipboardCheck, CalendarDays, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatTime12Hour } from '../lib/timeFormat';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { PageLoader } from '../components/LoadingSpinner';
import { Avatar } from '../components/Avatar';
import { Modal } from '../components/Modal';
import { LeadershipHeroCard } from '../components/LeadershipHeroCard';
import type { Profile } from '../types';

interface UnavailabilityRequest {
  id: string;
  user_id: string;
  unavailable_date: string | null;
  reason: string;
  status: string;
  created_at: string;
  is_recurring: boolean;
  recurrence_type: string | null;
  approval_notes: string | null;
  leave_type: string | null;
  start_date: string | null;
  end_date: string | null;
  profiles: Profile;
}

interface RequestsProps {
  embedded?: boolean;
}

interface LeaveEvent {
  id: string;
  title: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  event_type: string;
}

function getLeaveStart(request: UnavailabilityRequest) {
  return request.leave_type === 'range'
    ? request.start_date
    : request.unavailable_date;
}

function getLeaveEnd(request: UnavailabilityRequest) {
  return request.leave_type === 'range'
    ? request.end_date || request.start_date
    : request.unavailable_date;
}

function formatLeaveDate(request: UnavailabilityRequest) {
  if (request.leave_type === 'range' && request.start_date && request.end_date) {
    const start = parseISO(request.start_date);
    const end = parseISO(request.end_date);
    if (format(start, 'MMM yyyy') === format(end, 'MMM yyyy')) {
      return `${format(start, 'MMM d')}–${format(end, 'd, yyyy')}`;
    }
    return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
  }
  return request.unavailable_date
    ? format(parseISO(request.unavailable_date), 'EEEE, MMM d, yyyy')
    : '—';
}

function getEventsDuringLeave(request: UnavailabilityRequest, events: LeaveEvent[]) {
  const start = getLeaveStart(request);
  const end = getLeaveEnd(request);
  if (!start || !end) return [];
  return events.filter(event => event.event_date >= start && event.event_date <= end);
}

function getApprovedLeaveConflicts(target: UnavailabilityRequest, approvedLeaves: UnavailabilityRequest[]) {
  const targetStart = getLeaveStart(target);
  const targetEnd = getLeaveEnd(target);
  if (!targetStart || !targetEnd) return [];

  return approvedLeaves.filter(approvedLeave => {
    if (approvedLeave.user_id === target.user_id) return false;
    const approvedStart = getLeaveStart(approvedLeave);
    const approvedEnd = getLeaveEnd(approvedLeave);
    return Boolean(approvedStart && approvedEnd && approvedStart <= targetEnd && targetStart <= approvedEnd);
  });
}

function LeaveConflictWarning({
  request,
  approvedLeaves,
  events,
  context,
  display = 'panel',
}: {
  request: UnavailabilityRequest;
  approvedLeaves: UnavailabilityRequest[];
  events: LeaveEvent[];
  context: 'pending' | 'approved';
  display?: 'panel' | 'badge';
}) {
  const [open, setOpen] = useState(false);
  const conflicts = getApprovedLeaveConflicts(request, approvedLeaves);
  if (conflicts.length === 0) return null;

  const names = conflicts
    .map(conflict => `${conflict.profiles.first_name} ${conflict.profiles.last_name}`.trim())
    .filter(Boolean);
  const visibleNames = names.slice(0, 2).join(' and ');
  const remainingCount = Math.max(0, names.length - 2);
  const scheduledEvents = getEventsDuringLeave(request, events);
  const eventTypes = [...new Set(scheduledEvents.map(event => event.event_type).filter(Boolean))];
  const includesRehearsal = eventTypes.some(eventType => eventType.toLowerCase().includes('rehearsal'));
  const subject = visibleNames || `${conflicts.length} other team member${conflicts.length === 1 ? '' : 's'}`;
  const conflictSummary = `${subject}${remainingCount > 0 ? ` and ${remainingCount} more` : ''} ${conflicts.length === 1 ? 'already has' : 'already have'} approved leave overlapping this ${context === 'pending' ? 'request' : 'leave'}.`;
  const suggestion = includesRehearsal
    ? `Consider moving the rehearsal if possible, or arrange coverage ${context === 'pending' ? 'before approving' : 'now'}.`
      : eventTypes.length > 0
      ? `Review coverage for ${eventTypes.join(' and ')}. If a related rehearsal can be moved, consider rescheduling it; otherwise arrange substitutes ${context === 'pending' ? 'before approving' : 'early'}.`
      : `Confirm team coverage ${context === 'pending' ? 'before approving another leave' : 'for all approved leaves'} in this period.`;

  if (display === 'badge') {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-amber-300/80 bg-amber-50 px-3 text-[11px] font-bold text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/[0.1] dark:text-amber-200 dark:hover:bg-amber-500/[0.16]"
          aria-haspopup="dialog"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>Coverage warning</span>
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-200/80 px-1 text-[10px] text-amber-900 dark:bg-amber-400/20 dark:text-amber-100">{conflicts.length}</span>
        </button>
        <Modal open={open} onClose={() => setOpen(false)} title="Coverage warning" size="sm">
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/25 dark:bg-amber-500/[0.1]">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-6 text-amber-950 dark:text-amber-100">{conflictSummary}</p>
                <p className="mt-2 text-sm leading-6 text-amber-900/75 dark:text-amber-100/70"><span className="font-bold">Plan ahead:</span> {suggestion}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-100"
            >
              Got it
            </button>
          </div>
        </Modal>
      </>
    );
  }

  return (
    <section className="border-t border-amber-200/80 bg-amber-50/75 px-5 py-3 dark:border-amber-500/20 dark:bg-amber-500/[0.08]" role="alert">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-amber-800 dark:text-amber-200">Coverage warning</p>
          <p className="mt-1 text-[11px] font-semibold leading-5 text-amber-900/80 dark:text-amber-100/70">{conflictSummary}</p>
          <p className="mt-1 text-[11px] leading-5 text-amber-800/75 dark:text-amber-200/60"><span className="font-bold">Plan ahead:</span> {suggestion}</p>
        </div>
      </div>
    </section>
  );
}

function EventScheduleDuringLeave({
  request,
  events,
  loadError,
  separated = true,
}: {
  request: UnavailabilityRequest;
  events: LeaveEvent[];
  loadError: boolean;
  separated?: boolean;
}) {
  const scheduledEvents = getEventsDuringLeave(request, events);
  const showEventDate = getLeaveStart(request) !== getLeaveEnd(request);

  return (
    <section className={`${separated ? 'border-t border-black/[0.06] dark:border-white/[0.07]' : ''} px-4 py-3`}>
      <div className="flex items-center gap-2">
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
        <p className="flex-1 text-[10px] font-black uppercase tracking-[0.12em] text-sky-800 dark:text-sky-200">Events during this leave</p>
        {!loadError && scheduledEvents.length > 0 && (
          <span className="text-[10px] font-black text-sky-700 dark:text-sky-300">
            {scheduledEvents.length}
          </span>
        )}
      </div>

      <div className="pt-2.5">
        {loadError ? (
          <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">Event schedule could not be loaded.</p>
        ) : scheduledEvents.length === 0 ? (
          <p className="text-[11px] font-semibold text-sky-800/65 dark:text-sky-200/50">No church events are scheduled during this leave.</p>
        ) : (
          <div className="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
            {scheduledEvents.map(event => {
              const time = event.start_time ? formatTime12Hour(event.start_time) : '';
              return (
                <div key={event.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-500/15">
                    <CalendarDays className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-gray-900 dark:text-white">{event.title}</p>
                      <p className="mt-0.5 text-[10px] font-semibold text-gray-500 dark:text-white/40">{event.event_type}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      {showEventDate && (
                        <p className="text-[10px] font-bold text-sky-700 dark:text-sky-300">{format(parseISO(event.event_date), 'EEE, MMM d')}</p>
                      )}
                      <p className={`${showEventDate ? 'mt-1' : 'mt-0.5'} text-[10px] font-semibold text-gray-500 dark:text-white/45`}>{time || 'Time TBA'}</p>
                    </div>
                  </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export function Requests({ embedded }: RequestsProps = {}) {
  const { canApproveLeave } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<UnavailabilityRequest[]>([]);
  const [approvedUpcoming, setApprovedUpcoming] = useState<UnavailabilityRequest[]>([]);
  const [leaveEvents, setLeaveEvents] = useState<LeaveEvent[]>([]);
  const [eventScheduleError, setEventScheduleError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [approvalModal, setApprovalModal] = useState<{ request: UnavailabilityRequest; approved: boolean } | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchRequests = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const [pendingResult, approvedResult, eventsResult] = await Promise.all([
      supabase
        .from('user_availability')
        .select('*, profiles!user_availability_user_id_fkey(*)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true }),
      supabase
        .from('user_availability')
        .select('*, profiles!user_availability_user_id_fkey(*)')
        .eq('status', 'approved')
        .or(`unavailable_date.gte.${today},end_date.gte.${today}`),
      supabase
        .from('events')
        .select('id,title,event_date,start_time,end_time,event_type')
        .gte('event_date', today)
        .order('event_date', { ascending: true }),
    ]);

    if (pendingResult.error) {
      console.error('Error fetching requests:', pendingResult.error);
    }
    if (approvedResult.error) {
      console.error('Error fetching approved upcoming leave:', approvedResult.error);
    }
    if (eventsResult.error) console.error('Error fetching events for leave planning:', eventsResult.error);

    setRequests((pendingResult.data || []) as UnavailabilityRequest[]);
    setApprovedUpcoming(((approvedResult.data || []) as UnavailabilityRequest[]).sort((a, b) => {
      const aDate = a.leave_type === 'range' ? a.start_date : a.unavailable_date;
      const bDate = b.leave_type === 'range' ? b.start_date : b.unavailable_date;
      return String(aDate || '').localeCompare(String(bDate || ''));
    }));

    const events = (eventsResult.data || []) as LeaveEvent[];
    setLeaveEvents(events);
    setEventScheduleError(Boolean(eventsResult.error));
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();

    const channel = supabase
      .channel('user_availability_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_availability' }, fetchRequests)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const openApprovalModal = (request: UnavailabilityRequest, approved: boolean) => {
    setApprovalNotes('');
    setApprovalModal({ request, approved });
  };

  const handleApproval = async () => {
    if (!approvalModal) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setSaving(true);
    const { error } = await supabase
      .from('user_availability')
      .update({
        status: approvalModal.approved ? 'approved' : 'rejected',
        approved_by: user.id,
        reviewed_at: new Date().toISOString(),
        approval_notes: approvalNotes || null,
      })
      .eq('id', approvalModal.request.id);

    if (error) {
      toast('error', 'Failed to update request');
      setSaving(false);
      return;
    }

    toast('success', approvalModal.approved ? 'Request approved' : 'Request denied');
    setSaving(false);
    setApprovalModal(null);
    fetchRequests();
  };

  if (loading) return <PageLoader />;

  if (!canApproveLeave) {
    return (
      <div className={embedded ? '' : 'page-container page-bottom-pad'}>
        <div className={embedded ? '' : 'relative max-w-2xl lg:max-w-6xl xl:max-w-[1560px] mx-auto pt-4 sm:pt-5 pb-6 px-4 sm:px-6 lg:px-8'}>
          <div className="rounded-3xl border border-gray-200/80 dark:border-white/[0.06] bg-white dark:bg-white/[0.025] p-12 text-center" style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px -12px rgba(15,23,42,0.10)' }}>
            <div
              className="relative h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'linear-gradient(145deg, #94a3b8, #64748b)', boxShadow: '0 4px 14px rgba(100,116,139,0.25)' }}
            >
              <Shield className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white" style={{ letterSpacing: '-0.02em' }}>Access Restricted</h2>
            <p className="text-sm text-gray-500 dark:text-white/45 mt-1">Only authorized leaders can manage leave requests.</p>
          </div>
        </div>
      </div>
    );
  }

  const content = (
    <>
    <div className={embedded ? 'space-y-5' : 'space-y-5 sm:space-y-6'}>
        {!embedded && (
          <LeadershipHeroCard
            tone="amber"
            icon={ClipboardCheck}
            eyebrow="Pending Review"
            title="Leave Requests."
            description="Review member leave requests and respond quickly so the team can plan ahead."
            action={(
              <button
                onClick={fetchRequests}
                className="inline-flex items-center justify-center h-11 w-11 rounded-full text-gray-600 dark:text-white/55 bg-white/78 dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.08] hover:bg-white dark:hover:bg-white/[0.08] active:scale-[0.95] transition-colors shrink-0"
                title="Refresh"
                aria-label="Refresh leave requests"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            )}
          />
        )}
        {embedded && (
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2.5 px-0.5">
              <span className="text-[10px] font-mono font-semibold tabular-nums text-gray-400/70 dark:text-white/25 tracking-widest">01</span>
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-white/45 flex items-center gap-1.5">
                <ClipboardCheck className="h-3 w-3" /> Pending Requests
              </span>
              {requests.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-md bg-amber-50 dark:bg-amber-500/[0.18] text-amber-700 dark:text-amber-400 text-[10px] font-black border border-amber-200 dark:border-amber-500/25">
                  {requests.length}
                </span>
              )}
            </div>
            <button
              onClick={fetchRequests}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/[0.06] bg-white/70 text-gray-500 transition-colors hover:bg-white active:scale-[0.95] dark:border-white/[0.07] dark:bg-white/[0.04] dark:text-white/45 dark:hover:bg-white/[0.07]"
              title="Refresh"
              aria-label="Refresh leave requests"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
        )}

        {requests.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-3xl bg-white dark:bg-white/[0.025] border border-gray-200/80 dark:border-white/[0.06] p-12 text-center"
            style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px -12px rgba(15,23,42,0.10)' }}
          >
            <div
              className="relative h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'linear-gradient(145deg,#16a34a,#15803d)', boxShadow: '0 4px 14px rgba(22,163,74,0.3)' }}
            >
              <Check className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white" style={{ letterSpacing: '-0.02em' }}>All Caught Up</h2>
            <p className="text-sm text-gray-400 dark:text-white/40 mt-1">No pending leave requests.</p>
          </motion.div>
        ) : (
          <motion.div
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
            className="space-y-2.5"
          >
            {requests.map((request) => (
              <motion.div
                key={request.id}
                variants={{ hidden: { opacity: 0, y: 10, filter: 'blur(4px)' }, show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } } }}
                className="relative rounded-3xl overflow-hidden bg-white dark:bg-white/[0.025] border border-gray-200/80 dark:border-white/[0.06] transition-all duration-200"
                style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px -12px rgba(15,23,42,0.10)' }}
              >
                <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.06] dark:via-white/[0.12] to-transparent" />

                <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(290px,0.75fr)_minmax(190px,0.45fr)]">
                  <div className="relative flex items-start gap-3.5 px-5 py-4">
                    <Avatar src={request.profiles.avatar_url} firstName={request.profiles.first_name} lastName={request.profiles.last_name} size="md" className="shrink-0 mt-0.5 ring-1 ring-black/[0.06] dark:ring-white/[0.08]" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 flex-wrap">
                        <p className="text-[14px] font-bold text-gray-900 dark:text-white" style={{ letterSpacing: '-0.015em' }}>
                          {request.profiles.first_name} {request.profiles.last_name}
                        </p>
                        {request.is_recurring && request.recurrence_type && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/[0.12] text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/25">
                            Recurring: {request.recurrence_type}
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] text-gray-700 dark:text-white/65 mt-1 font-medium">
                        Unavailable <span className="font-bold text-gray-900 dark:text-white">{formatLeaveDate(request)}</span>
                      </p>
                      {request.reason && (
                        <div className="mt-2.5 px-3 py-2.5 rounded-2xl bg-gray-50 dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.06]">
                          <p className="text-[12px] text-gray-600 dark:text-white/55 leading-relaxed">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-white/30 block mb-1">Reason</span>
                            {request.reason}
                          </p>
                        </div>
                      )}
                      <p className="text-[11px] font-mono text-gray-400 dark:text-white/30 mt-2 tracking-wide">
                        Submitted {format(parseISO(request.created_at), "MMM d 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                  <div className="border-t border-black/[0.06] dark:border-white/[0.07] lg:border-l lg:border-t-0">
                    <EventScheduleDuringLeave
                      request={request}
                      events={leaveEvents}
                      loadError={eventScheduleError}
                      separated={false}
                    />
                  </div>
                  <div className="flex flex-col justify-center gap-2 border-t border-black/[0.06] p-4 dark:border-white/[0.07] lg:border-l lg:border-t-0">
                    <LeaveConflictWarning
                      request={request}
                      approvedLeaves={approvedUpcoming}
                      events={leaveEvents}
                      context="pending"
                      display="badge"
                    />
                    <div className="flex gap-2 lg:flex-col">
                      <button
                        onClick={() => openApprovalModal(request, false)}
                        className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 text-[12px] font-semibold text-red-700 transition-colors hover:bg-red-100 active:scale-[0.97] dark:border-red-500/25 dark:bg-red-500/[0.12] dark:text-red-300 dark:hover:bg-red-500/[0.18]"
                      >
                        <X className="h-3.5 w-3.5" /> Deny
                      </button>
                      <button
                        onClick={() => openApprovalModal(request, true)}
                        className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-[12px] font-semibold text-white transition-all active:scale-[0.97]"
                        style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 3px 10px rgba(22,163,74,0.3)' }}
                      >
                        <Check className="h-3.5 w-3.5" /> Approve
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {!embedded && (
          <section className="pt-2 sm:pt-3">
            <div className="mb-3 flex items-end justify-between gap-3 px-1">
              <div>
                <p className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
                  <CalendarDays className="h-4 w-4 text-emerald-500" />
                  Approved Upcoming Leaves
                </p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-white/40">Review upcoming absences and overlapping leave dates.</p>
              </div>
              <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-2 text-xs font-bold text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/[0.12] dark:text-emerald-300">
                {approvedUpcoming.length}
              </span>
            </div>

            {approvedUpcoming.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center dark:border-white/[0.08]">
                <p className="text-sm font-semibold text-gray-700 dark:text-white/65">No approved upcoming leave</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-white/35">Approved requests will appear here.</p>
              </div>
            ) : (
              <div className="grid gap-2.5 lg:grid-cols-2">
                {approvedUpcoming.map(request => {
                  return (
                    <div key={request.id} className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white dark:border-white/[0.07] dark:bg-white/[0.025]">
                      <div className="flex items-start gap-3 px-4 py-3">
                        <Avatar src={request.profiles.avatar_url} firstName={request.profiles.first_name} lastName={request.profiles.last_name} size="sm" className="ring-1 ring-black/[0.06] dark:ring-white/[0.08]" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{request.profiles.first_name} {request.profiles.last_name}</p>
                            <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/[0.12] dark:text-emerald-300">Approved</span>
                          </div>
                          <p className="mt-1 text-xs font-semibold text-gray-700 dark:text-white/65">{formatLeaveDate(request)}</p>
                          {request.reason && <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500 dark:text-white/40">{request.reason}</p>}
                        </div>
                      </div>
                      <EventScheduleDuringLeave
                        request={request}
                        events={leaveEvents}
                        loadError={eventScheduleError}
                      />
                      <LeaveConflictWarning
                        request={request}
                        approvedLeaves={approvedUpcoming}
                        events={leaveEvents}
                        context="approved"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      <Modal
        open={!!approvalModal}
        onClose={() => setApprovalModal(null)}
        title={approvalModal?.approved ? 'Approve Request' : 'Deny Request'}
        size="sm"
      >
        {approvalModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {approvalModal.approved ? 'Approving' : 'Denying'} leave request for{' '}
              <span className="font-medium text-gray-900 dark:text-white">
                {approvalModal.request.profiles.first_name} {approvalModal.request.profiles.last_name}
              </span>{' '}
              on {
                approvalModal.request.leave_type === 'range' && approvalModal.request.start_date && approvalModal.request.end_date
                  ? `${format(parseISO(approvalModal.request.start_date), 'MMM d')} – ${format(parseISO(approvalModal.request.end_date), 'MMM d, yyyy')}`
                  : approvalModal.request.unavailable_date
                    ? format(parseISO(approvalModal.request.unavailable_date), 'MMM d, yyyy')
                    : '—'
              }.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Note to member (optional)
                </span>
              </label>
              <textarea
                value={approvalNotes}
                onChange={e => setApprovalNotes(e.target.value)}
                className="input-field min-h-[72px] resize-none"
                placeholder={approvalModal.approved ? 'e.g., Thank you for letting us know.' : 'e.g., We need you for this service.'}
                autoFocus
              />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button onClick={() => setApprovalModal(null)} className="btn-secondary min-h-11 justify-center">Cancel</button>
              <button
                onClick={handleApproval}
                disabled={saving}
                className={`btn-primary min-h-11 justify-center ${approvalModal.approved ? '' : 'bg-red-600 hover:bg-red-700 ring-red-300'}`}
              >
                {saving ? 'Saving...' : approvalModal.approved ? 'Approve' : 'Deny'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );

  if (embedded) return content;

  return (
    <div className="page-container page-bottom-pad">
      <div className="app-content-shell relative pb-6 pt-4 sm:pt-5">
        {content}
      </div>
    </div>
  );
}

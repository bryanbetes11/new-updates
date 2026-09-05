import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { AlertCircle, ArrowLeftRight, Calendar, CheckCircle, Clock, ListChecks, Music, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { PageLoader } from '../components/LoadingSpinner';
import { useRecoverableDraft } from '../hooks/useRecoverableDraft';
import { draftRecoveryKey } from '../lib/draftRecovery';
import { compareEventSchedule } from '../lib/eventChronology';
import { formatTime12Hour } from '../lib/timeFormat';
import { SwapRequestModal } from '../components/SwapRequestModal';
import { useToast } from '../contexts/ToastContext';
import { dispatchBadgeCountsRefresh } from '../lib/realtimeSignals';
import { EventTypeLabel } from '../components/EventTypeLabel';
import { EventDateChip } from '../components/EventDateChip';
import { Modal } from '../components/Modal';
import type { EventAssignment, SwapRequest } from '../types';

type Filter = 'all' | 'confirmed' | 'pending' | 'declined';

export function shouldShowInMyAssignments(assignment: EventAssignment, today: string) {
  const eventDate = assignment.events?.event_date;
  if (!eventDate) return false;

  // Keep unresolved assignments actionable even after their event date. Once
  // resolved, historical assignments belong in the event/attendance history.
  return assignment.status === 'pending' || eventDate >= today;
}

const STATUS_CONFIG = {
  confirmed: { label: 'Confirmed', dot: '#16a34a', bg: 'bg-green-50 dark:bg-green-950/60',   text: 'text-green-700 dark:text-green-400', ring: 'ring-green-200 dark:ring-green-700/40' },
  pending:   { label: 'Pending',   dot: '#d97706', bg: 'bg-amber-50 dark:bg-amber-950/60',   text: 'text-amber-700 dark:text-amber-400', ring: 'ring-amber-200 dark:ring-amber-700/40' },
  declined:  { label: 'Declined',  dot: '#dc2626', bg: 'bg-red-50   dark:bg-red-950/60',     text: 'text-red-700   dark:text-red-400',   ring: 'ring-red-200   dark:ring-red-700/40'   },
};

export function MyAssignments() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<EventAssignment[]>([]);
  const [filter, setFilter] = useState<Filter>(
    (searchParams.get('status') as Filter) || 'all'
  );
  const [swapModalAssignment, setSwapModalAssignment] = useState<EventAssignment | null>(null);
  const [sentSwapRequests, setSentSwapRequests] = useState<SwapRequest[]>([]);
  const [cancellingSwap, setCancellingSwap] = useState<string | null>(null);
  const [confirmingAssignmentId, setConfirmingAssignmentId] = useState<string | null>(null);
  const [confirmModalAssignment, setConfirmModalAssignment] = useState<EventAssignment | null>(null);
  const [declineAssignment, setDeclineAssignment] = useState<EventAssignment | null>(null);
  const [declineReason, setDeclineReason, declineRecovery] = useRecoverableDraft(draftRecoveryKey(`decline:${declineAssignment?.id || ''}`, profile?.org_id, user?.id), '', (value): value is string => typeof value === 'string');
  const [declining, setDeclining] = useState(false);
  const decliningRef = useRef(false);
  const handleDecline = async () => {
    if (!user || !declineAssignment || !declineReason.trim() || decliningRef.current) return;
    decliningRef.current = true; setDeclining(true);
    try {
      const { data, error } = await supabase.from('event_assignments')
        .update({ status: 'declined', decline_reason: declineReason.trim(), confirmed_at: null })
        .eq('id', declineAssignment.id).eq('user_id', user.id).eq('status', declineAssignment.status).select('id, status').single();
      if (error || data?.status !== 'declined') throw error;
      setAssignments(current => current.map(item => item.id === declineAssignment.id ? { ...item, status: 'declined', decline_reason: declineReason.trim() } : item));
      declineRecovery.discard(); setDeclineAssignment(null); dispatchBadgeCountsRefresh();
      toast('success', 'Response saved');
    } catch { toast('error', 'Could not save your response. Your reason is kept; please try again.'); }
    finally { decliningRef.current = false; setDeclining(false); }
  };
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoadError(null);
      setLoading(true);
      try {
        const today = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Manila',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date());
        const { data, error } = await supabase
          .from('event_assignments')
          .select('*, events(*), roles(*)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (error) throw error;

        const list = ((data || []) as EventAssignment[])
          .filter(a => shouldShowInMyAssignments(a, today))
          .sort((a, b) => compareEventSchedule(a.events!, b.events!));

        setAssignments(list);

        const { data: swapData, error: swapError } = await supabase
          .from('user_availability')
          .select(`
            *,
            target:target_id(id, first_name, last_name, nickname, avatar_url),
            requester_assignment:requester_assignment_id(*, events(*), roles(*)),
            target_assignment:target_assignment_id(*, events(*), roles(*))
          `)
          .eq('user_id', user.id)
          .neq('request_type', 'leave')
          .not('status', 'in', '("approved","withdrawn")')
          .order('created_at', { ascending: false });
        if (swapError) throw swapError;
        setSentSwapRequests((swapData || []) as SwapRequest[]);
      } catch {
        setLoadError('We could not load your assignments. Check your connection and try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, reloadKey]);

  useEffect(() => {
    const status = searchParams.get('status') as Filter;
    if (status && ['all', 'confirmed', 'pending', 'declined'].includes(status)) {
      setFilter(status);
    }
  }, [searchParams]);

  const handleFilter = (f: Filter) => {
    setFilter(f);
    if (f === 'all') {
      setSearchParams({});
    } else {
      setSearchParams({ status: f });
    }
  };

  const filtered = filter === 'all' ? assignments : assignments.filter(a => a.status === filter);

  const handleConfirm = async (assignment: EventAssignment) => {
    if (!user?.id || confirmingAssignmentId) return;

    setConfirmingAssignmentId(assignment.id);
    try {
      const { data, error } = await supabase
        .from('event_assignments')
        .update({ status: 'confirmed', confirmed_at: new Date().toISOString(), decline_reason: null })
        .eq('id', assignment.id)
        .eq('user_id', user.id)
        .select('id, status')
        .maybeSingle();

      if (error || data?.status !== 'confirmed') {
        toast('error', error?.message || 'Could not confirm this assignment');
        return;
      }

      setAssignments(current => current.map(item => (
        item.id === assignment.id
          ? { ...item, status: 'confirmed', confirmed_at: new Date().toISOString(), decline_reason: '' }
          : item
      )));
      dispatchBadgeCountsRefresh();
      toast('success', 'Assignment confirmed');
      setConfirmModalAssignment(null);
    } catch {
      toast('error', 'Could not confirm this assignment');
    } finally {
      setConfirmingAssignmentId(null);
    }
  };

  const handleCancelSwap = async (swapId: string) => {
    if (cancellingSwap || !user) return;
    setCancellingSwap(swapId);
    try {
      const { data, error } = await supabase.from('user_availability').update({ status: 'withdrawn' }).eq('id', swapId).eq('user_id', user.id).select('id, status').single();
      if (error || data?.status !== 'withdrawn') throw error;
      setSentSwapRequests(prev => prev.filter(r => r.id !== swapId));
      dispatchBadgeCountsRefresh();
      toast('success', 'Request cancelled');
    } catch {
      toast('error', 'Could not cancel your request. Please try again.');
    } finally { setCancellingSwap(null); }
  };

  if (loading) return <PageLoader />;

  const stats = {
    total:     assignments.length,
    confirmed: assignments.filter(a => a.status === 'confirmed').length,
    pending:   assignments.filter(a => a.status === 'pending').length,
    declined:  assignments.filter(a => a.status === 'declined').length,
  };

  const filterTabs: { key: Filter; label: string; count: number; icon: React.ReactNode }[] = [
    { key: 'all',       label: 'All',       count: stats.total,     icon: <ListChecks className="h-3.5 w-3.5" /> },
    { key: 'confirmed', label: 'Confirmed', count: stats.confirmed, icon: <CheckCircle className="h-3.5 w-3.5" /> },
    { key: 'pending',   label: 'Pending',   count: stats.pending,   icon: <Clock className="h-3.5 w-3.5" /> },
    ...(stats.declined > 0
      ? [{ key: 'declined' as Filter, label: 'Declined', count: stats.declined, icon: <X className="h-3.5 w-3.5" /> }]
      : []),
  ];

  return (
    <>
    <div className="page-container page-bottom-pad profile-page-scroll">
      <div className="app-content-shell space-y-6 pb-6 pt-4 sm:pt-5">

        {/* Header */}
        <div className="animate-fade-in">
          <p className="text-[10px] font-mono font-medium uppercase tracking-[0.22em] text-gray-500 dark:text-white/40 mb-2">
            My Schedule
          </p>
          <h1
            className="text-[2rem] sm:text-[2.6rem] font-black leading-[0.96] text-gray-900 dark:text-white"
          >
            My Assignments
          </h1>
          <p className="mt-2 text-[13px] text-gray-500 dark:text-white/40 font-light">
            Your upcoming schedule and any assignments still awaiting your response.
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2 animate-fade-in">
          {filterTabs.map(t => (
            <button
              type="button"
              key={t.key}
              onClick={() => handleFilter(t.key)}
              className={`flex items-center gap-1.5 h-11 px-4 rounded-full text-[12px] font-semibold transition-all duration-200 border ${
                filter === t.key
                  ? 'bg-brand-600 dark:bg-brand-500 text-white border-brand-600 dark:border-brand-500 shadow-sm'
                  : 'bg-white dark:bg-white/[0.04] text-gray-500 dark:text-white/40 border-gray-200/80 dark:border-white/[0.07] hover:text-gray-700 dark:hover:text-white/70 hover:border-gray-300 dark:hover:border-white/[0.12]'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
              <span className={`text-[10px] tabular-nums ${filter === t.key ? 'text-white/70' : 'text-gray-400 dark:text-white/25'}`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Assignment list */}
        <div className="animate-slide-up">
          {/* List header */}
          <div className="flex items-center gap-2.5 border-b border-gray-200/80 px-1 py-4 dark:border-white/[0.08]">
            <div className="h-7 w-7 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              <Music className="h-3.5 w-3.5" />
            </div>
            <span className="text-[13px] font-semibold text-gray-900 dark:text-white">
              {filter === 'all' ? 'All Assignments' :
               filter === 'confirmed' ? 'Confirmed' :
               filter === 'pending' ? 'Pending' : 'Declined'}
            </span>
            <span className="ml-auto font-mono text-[11px] text-gray-400 dark:text-white/30 tabular-nums">
              {filtered.length}
            </span>
          </div>

          {/* Error and empty states */}
          {loadError ? (
            <div className="bg-white px-5 py-14 text-center dark:bg-white/[0.025]" role="alert">
              <AlertCircle className="mx-auto h-7 w-7 text-red-500" />
              <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-white">Unable to load assignments</p>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-gray-500 dark:text-white/45">{loadError}</p>
              <button type="button" onClick={() => setReloadKey(value => value + 1)} className="btn-primary mt-4 min-h-11">
                Try again
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white dark:bg-white/[0.025] px-5 py-16 text-center">
              <div className="h-12 w-12 rounded-2xl bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-6 w-6 text-gray-400 dark:text-white/30" />
              </div>
              <p className="text-[14px] font-medium text-gray-500 dark:text-white/40">
                No {filter !== 'all' ? filter : ''} assignments
              </p>
              <p className="text-[12px] text-gray-400 dark:text-white/25 mt-1">
                Check back after schedules are published.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200/70 dark:divide-white/[0.07]">
              {filtered.map(a => {
                const cfg = STATUS_CONFIG[a.status as keyof typeof STATUS_CONFIG];
                return (
                  <div
                    key={a.id}
                    className="group relative flex w-full flex-col transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-white/[0.03] sm:flex-row sm:items-stretch sm:gap-2 sm:pr-2"
                  >
                    <button
                      type="button"
                      onClick={() => navigate(`/events/${a.event_id}`, {
                        state: { returnTo: `${location.pathname}${location.search}` },
                      })}
                      className="grid min-w-0 flex-1 grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3 px-3 pb-2 pt-4 text-left sm:flex sm:gap-4 sm:py-4 sm:pl-5 sm:pr-0"
                      aria-label={`Open ${a.events?.title || 'event'} assignment`}
                    >
                    {/* Date tile */}
                    {a.events?.event_date && (
                      <div className="absolute inset-y-4 left-3 flex w-[4.5rem] items-center justify-center sm:static sm:w-auto">
                        <EventDateChip date={a.events.event_date} compact mobileLarge />
                      </div>
                    )}

                    {/* Content */}
                    <div className="col-start-2 min-w-0 flex-1 sm:col-auto">
                      <div className="mb-0.5 flex items-center gap-2">
                        <p className="text-[14px] font-semibold text-gray-900 dark:text-white truncate">
                          {a.events?.title}
                        </p>
                      </div>
                      <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[13px] text-gray-600 dark:text-white/55">
                        <span>{a.roles?.name}</span>
                        {a.events?.event_type && (
                          <span className="inline-flex align-middle">
                            <EventTypeLabel type={a.events.event_type} filled />
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-gray-400 dark:text-white/30 uppercase tracking-wide">
                          <Calendar className="h-3 w-3" />
                          {a.events?.event_date && format(parseISO(a.events.event_date), 'EEE, MMM d')}
                        </span>
                        {a.events?.start_time && (
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-gray-400 dark:text-white/30">
                            <Clock className="h-3 w-3" />
                            {formatTime12Hour(a.events.start_time)}
                          </span>
                        )}
                      </div>
                      {a.status === 'declined' && a.decline_reason && (
                        <p className="text-[11px] text-red-500 dark:text-red-400 mt-1.5 italic">
                          {a.decline_reason}
                        </p>
                      )}
                    </div>

                    {/* Status + chevron */}
                    <div className="hidden shrink-0 items-center gap-2 sm:flex">
                      {cfg && (
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ${cfg.bg} ${cfg.text} ${cfg.ring}`}>
                          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: cfg.dot }} />
                          {cfg.label}
                        </span>
                      )}
                    </div>
                    </button>
                    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 px-3 pb-4 sm:contents sm:p-0">
                      <div className="col-start-2 flex min-w-0 flex-wrap items-center gap-2 sm:contents">
                        {cfg && (
                          <span className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[11px] font-bold ring-1 sm:hidden ${cfg.bg} ${cfg.text} ${cfg.ring}`}>
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: cfg.dot }} />
                            {cfg.label}
                          </span>
                        )}
                        {cfg && a.status !== 'declined' && (
                          <span className="h-5 w-px shrink-0 bg-gray-300 dark:bg-white/15 sm:hidden" aria-hidden="true" />
                        )}
                        {a.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => setConfirmModalAssignment(a)}
                            disabled={confirmingAssignmentId !== null}
                            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-brand-500 px-3 text-[11px] font-bold text-white transition hover:bg-brand-400 disabled:cursor-wait disabled:opacity-55 sm:self-center sm:px-2.5 sm:text-[10px]"
                            aria-label={`Confirm ${a.events?.title || 'assignment'}`}
                          >
                            {confirmingAssignmentId === a.id ? 'Confirming…' : 'Confirm'}
                          </button>
                        )}
                        {(a.status === 'pending' || (a.status === 'confirmed' && a.roles?.name === 'All Members')) && (
                          <button type="button" onClick={() => setDeclineAssignment(a)} aria-label={`Decline ${a.events?.title || 'invitation'}`} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 px-3 text-xs font-bold text-gray-600 dark:border-white/15 dark:text-white/70 sm:self-center">{a.roles?.name === 'All Members' ? "Can't attend" : 'Decline'}</button>
                        )}
                        {a.status !== 'declined' && a.roles?.name !== 'All Members' && (
                          <button
                            type="button"
                            title={a.roles?.name === 'Song Leader' ? 'Request Schedule Swap' : 'Find a Sub'}
                            aria-label={a.roles?.name === 'Song Leader' ? `Request a schedule swap for ${a.events?.title || 'this event'}` : `Find a substitute for ${a.events?.title || 'this event'}`}
                            onClick={() => setSwapModalAssignment(a)}
                            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-[11px] font-bold text-gray-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-white/[0.09] dark:bg-white/[0.04] dark:text-white/55 dark:hover:border-brand-500/35 dark:hover:bg-brand-500/[0.10] dark:hover:text-brand-300 sm:self-center sm:px-2.5 sm:text-[10px]"
                          >
                            <ArrowLeftRight className="h-3.5 w-3.5" />
                            <span>{a.roles?.name === 'Song Leader' ? 'Swap' : 'Sub'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Sent Swap Requests ── */}
        {sentSwapRequests.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-0.5">
              <ArrowLeftRight className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-white/45">Your Sub & Swap Requests</span>
              <span className="text-[10px] font-mono text-gray-400 dark:text-white/25 tabular-nums ml-auto">{sentSwapRequests.length}</span>
            </div>

            <div
              className="rounded-3xl overflow-hidden border border-gray-200/80 dark:border-white/[0.06]"
              style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 28px -16px rgba(15,23,42,0.12)' }}
            >
              <div className="divide-y divide-gray-100 dark:divide-white/[0.05] bg-white dark:bg-white/[0.025]">
                {sentSwapRequests.map(req => {
                  const targetName = req.target?.nickname || `${req.target?.first_name} ${req.target?.last_name}`.trim();
                  const isTargetResponded = !!req.target_response_at;
                  const isSub = req.request_type === 'sub';
                  const statusConfig: Record<string, { label: string; dot: string; bg: string; text: string; ring: string }> = {
                    pending:      isTargetResponded 
                                    ? { label: 'Pending Approval',  dot: '#f59e0b', bg: 'bg-amber-950/60',  text: 'text-amber-400',  ring: 'ring-amber-700/40'  }
                                    : { label: 'Awaiting Response', dot: '#a78bfa', bg: 'bg-violet-950/60', text: 'text-violet-400', ring: 'ring-violet-700/40' },
                    rejected:     { label: 'Declined',          dot: '#ef4444', bg: 'bg-red-950/60',    text: 'text-red-400',    ring: 'ring-red-700/40'    },
                  };
                  const cfg = statusConfig[req.status];
                  const canCancel = req.status === 'pending';
                  return (
                    <div key={req.id} className="flex items-center gap-4 px-5 py-4">
                      {/* Icon */}
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-indigo-50 dark:bg-indigo-500/[0.10] text-indigo-500 dark:text-indigo-400 shrink-0">
                        <ArrowLeftRight className="h-4 w-4" />
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-gray-900 dark:text-white truncate leading-tight">
                          {isSub ? `Sub request to ${targetName}` : `Swap with ${targetName}`}
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-white/40 font-mono mt-0.5 truncate">
                          {req.requester_assignment?.events?.title}
                          {!isSub && (
                            <>
                              <span className="text-gray-300 dark:text-white/20 mx-1">↔</span>
                              {req.target_assignment?.events?.title}
                            </>
                          )}
                        </p>
                        <p className="text-[10px] text-gray-400 dark:text-white/25 font-mono mt-0.5">
                          {format(parseISO(req.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>

                      {/* Status + cancel */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {cfg && (
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ${cfg.bg} ${cfg.text} ${cfg.ring}`}>
                            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: cfg.dot }} />
                            {cfg.label}
                          </span>
                        )}
                        {canCancel && (
                          <button
                            type="button"
                            onClick={() => handleCancelSwap(req.id)}
                            disabled={cancellingSwap === req.id}
                            className="min-h-11 rounded-xl px-3 text-[10px] font-semibold text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/[0.1] dark:hover:text-red-300"
                          >
                            {cancellingSwap === req.id ? 'Cancelling…' : 'Cancel'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
      <Modal open={!!declineAssignment} onClose={() => { if (!decliningRef.current) setDeclineAssignment(null); }} title={declineAssignment?.roles?.name === 'All Members' ? "Can't attend" : 'Decline assignment'} size="sm" closeOnBackdrop={!declining} closeOnEscape={!declining}>
        <div className="space-y-4">
          <p className="font-bold">{declineAssignment?.events?.title}</p>
          <label className="block text-sm">Reason<textarea aria-label="Reason for declining" value={declineReason} onChange={event => setDeclineReason(event.target.value)} disabled={declining} className="input-field mt-2 min-h-24" /></label>
          <p className="text-xs text-gray-500 dark:text-gray-400">{declineRecovery.available ? 'Your reason is kept on this device until you submit or discard it.' : 'Draft recovery is unavailable. Keep this form open.'}</p>
          <div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={declining} className="btn-secondary min-h-11" onClick={() => { declineRecovery.discard(); setDeclineAssignment(null); }}>Discard</button><button type="button" disabled={declining || !declineReason.trim()} className="btn-primary min-h-11" onClick={() => void handleDecline()}>{declining ? 'Saving…' : 'Save response'}</button></div>
        </div>
      </Modal>
      <SwapRequestModal
      open={!!swapModalAssignment}
      onClose={() => setSwapModalAssignment(null)}
      myAssignment={swapModalAssignment}
      />
      <Modal
        open={confirmModalAssignment !== null}
        onClose={() => {
          if (!confirmingAssignmentId) setConfirmModalAssignment(null);
        }}
        title="Confirm Assignment"
        size="sm"
        mobileView="dialog"
        closeOnBackdrop={!confirmingAssignmentId}
        closeOnEscape={!confirmingAssignmentId}
        footer={confirmModalAssignment ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmModalAssignment(null)}
              disabled={confirmingAssignmentId !== null}
              className="h-11 flex-1 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50 dark:border-white/[0.08] dark:text-white/55 dark:hover:bg-white/[0.05]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleConfirm(confirmModalAssignment)}
              disabled={confirmingAssignmentId !== null}
              className="h-11 flex-[1.25] rounded-xl bg-brand-500 text-sm font-black text-white transition hover:bg-brand-400 disabled:cursor-wait disabled:opacity-60"
            >
              {confirmingAssignmentId ? 'Confirming…' : 'Confirm Assignment'}
            </button>
          </div>
        ) : undefined}
      >
        {confirmModalAssignment?.events && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 rounded-2xl border border-gray-200/80 bg-gray-50/70 p-4 dark:border-white/[0.07] dark:bg-white/[0.035]">
              <EventDateChip date={confirmModalAssignment.events.event_date} />
              <div className="min-w-0 flex-1">
                <p className="text-base font-black leading-tight text-gray-900 dark:text-white">
                  {confirmModalAssignment.events.title}
                </p>
                <div className="mt-2">
                  <EventTypeLabel type={confirmModalAssignment.events.event_type} filled />
                </div>
              </div>
            </div>

            <dl className="divide-y divide-gray-100 rounded-2xl border border-gray-200/80 px-4 dark:divide-white/[0.06] dark:border-white/[0.07]">
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-xs font-semibold text-gray-500 dark:text-white/40">Your role</dt>
                <dd className="text-right text-sm font-bold text-gray-900 dark:text-white">{confirmModalAssignment.roles?.name}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-xs font-semibold text-gray-500 dark:text-white/40">Date</dt>
                <dd className="text-right text-sm font-bold text-gray-900 dark:text-white">
                  {format(parseISO(confirmModalAssignment.events.event_date), 'EEEE, MMMM d, yyyy')}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <dt className="text-xs font-semibold text-gray-500 dark:text-white/40">Time</dt>
                <dd className="text-right text-sm font-bold text-gray-900 dark:text-white">
                  {formatTime12Hour(confirmModalAssignment.events.start_time)}
                  {confirmModalAssignment.events.end_time ? ` – ${formatTime12Hour(confirmModalAssignment.events.end_time)}` : ''}
                </dd>
              </div>
            </dl>

            <p className="mx-auto max-w-[19rem] text-balance text-center text-xs leading-relaxed text-gray-500 dark:text-white/40">
              {confirmModalAssignment.roles?.name === 'All Members' ? 'Confirming means you plan to attend this event.' : 'Confirming means you are available and committed to serve in this role.'}
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}

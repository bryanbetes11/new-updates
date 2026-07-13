import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, isAfter, parseISO, startOfToday } from 'date-fns';
import { AlertCircle, ArrowLeftRight, Calendar, CheckCircle, ChevronRight, Clock, ListChecks, Music, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { PageLoader } from '../components/LoadingSpinner';
import { formatTime12Hour } from '../lib/timeFormat';
import { SwapRequestModal } from '../components/SwapRequestModal';
import type { EventAssignment, SwapRequest } from '../types';

type Filter = 'all' | 'confirmed' | 'pending' | 'declined';

const STATUS_CONFIG = {
  confirmed: { label: 'Confirmed', dot: '#16a34a', bg: 'bg-green-50 dark:bg-green-950/60',   text: 'text-green-700 dark:text-green-400', ring: 'ring-green-200 dark:ring-green-700/40' },
  pending:   { label: 'Pending',   dot: '#d97706', bg: 'bg-amber-50 dark:bg-amber-950/60',   text: 'text-amber-700 dark:text-amber-400', ring: 'ring-amber-200 dark:ring-amber-700/40' },
  declined:  { label: 'Declined',  dot: '#dc2626', bg: 'bg-red-50   dark:bg-red-950/60',     text: 'text-red-700   dark:text-red-400',   ring: 'ring-red-200   dark:ring-red-700/40'   },
};

export function MyAssignments() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<EventAssignment[]>([]);
  const [filter, setFilter] = useState<Filter>(
    (searchParams.get('status') as Filter) || 'all'
  );
  const [swapModalAssignment, setSwapModalAssignment] = useState<EventAssignment | null>(null);
  const [sentSwapRequests, setSentSwapRequests] = useState<SwapRequest[]>([]);
  const [cancellingSwap, setCancellingSwap] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoadError(null);
      setLoading(true);
      try {
        const today = startOfToday().toISOString().split('T')[0];
        const { data, error } = await supabase
          .from('event_assignments')
          .select('*, events(*), roles(*)')
          .eq('user_id', user.id)
          .gte('events.event_date', today)
          .order('created_at', { ascending: false });
        if (error) throw error;

        const list = ((data || []) as EventAssignment[])
          .filter(a => a.events && isAfter(parseISO(a.events.event_date), startOfToday()))
          .sort((a, b) => parseISO(a.events!.event_date).getTime() - parseISO(b.events!.event_date).getTime());

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

  const handleCancelSwap = async (swapId: string) => {
    setCancellingSwap(swapId);
    await supabase.from('user_availability').update({ status: 'withdrawn' }).eq('id', swapId);
    setSentSwapRequests(prev => prev.filter(r => r.id !== swapId));
    setCancellingSwap(null);
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
    <div className="page-container page-bottom-pad">
      <div className="max-w-2xl lg:max-w-3xl mx-auto px-4 sm:px-5 lg:px-6 py-6 sm:py-8 space-y-6">

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
            Your upcoming event assignments and serving schedule.
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
        <div
          className="rounded-3xl overflow-hidden animate-slide-up border border-gray-200/80 dark:border-white/[0.06]"
          style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 28px -16px rgba(15,23,42,0.12)' }}
        >
          {/* List header */}
          <div className="flex items-center gap-2.5 px-5 py-4 bg-white dark:bg-white/[0.025] border-b border-gray-100 dark:border-white/[0.06]">
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
            <div className="divide-y divide-gray-100 dark:divide-white/[0.05] bg-white dark:bg-white/[0.025]">
              {filtered.map(a => {
                const cfg = STATUS_CONFIG[a.status as keyof typeof STATUS_CONFIG];
                return (
                  <div
                    key={a.id}
                    className="group flex w-full items-stretch transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-white/[0.03]"
                  >
                    <button
                      type="button"
                      onClick={() => navigate(`/events/${a.event_id}`)}
                      className="flex min-w-0 flex-1 items-center gap-4 py-4 pl-5 text-left"
                      aria-label={`Open ${a.events?.title || 'event'} assignment`}
                    >
                    {/* Date tile */}
                    <div className="flex flex-col items-center justify-center h-12 w-12 rounded-xl bg-brand-50 dark:bg-brand-900/25 text-brand-700 dark:text-brand-300 shrink-0">
                      <span className="font-mono text-[9px] font-semibold uppercase leading-none">
                        {a.events?.event_date && format(parseISO(a.events.event_date), 'MMM')}
                      </span>
                      <span className="font-mono text-[20px] font-bold leading-none mt-0.5">
                        {a.events?.event_date && format(parseISO(a.events.event_date), 'd')}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-[14px] font-semibold text-gray-900 dark:text-white truncate">
                          {a.events?.title}
                        </p>
                        {a.status === 'pending' && (
                          <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-[13px] text-gray-600 dark:text-white/55 mb-1.5">
                        {a.roles?.name}
                      </p>
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
                    <div className="flex items-center gap-2 shrink-0">
                      {cfg && (
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ${cfg.bg} ${cfg.text} ${cfg.ring}`}>
                          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: cfg.dot }} />
                          {cfg.label}
                        </span>
                      )}
                      <ChevronRight className="h-4 w-4 text-gray-300 dark:text-white/20 group-hover:text-gray-500 dark:group-hover:text-white/40 transition-colors" />
                    </div>
                    </button>
                    {a.status !== 'declined' && (
                      <button
                        type="button"
                        title={a.roles?.name === 'Song Leader' ? 'Request Schedule Swap' : 'Find a Sub'}
                        aria-label={a.roles?.name === 'Song Leader' ? `Request a schedule swap for ${a.events?.title || 'this event'}` : `Find a substitute for ${a.events?.title || 'this event'}`}
                        onClick={() => setSwapModalAssignment(a)}
                        className="mr-2 flex h-11 w-11 shrink-0 self-center items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:text-white/30 dark:hover:bg-brand-900/20 dark:hover:text-brand-400"
                      >
                        <ArrowLeftRight className="h-4 w-4" />
                      </button>
                    )}
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
    <SwapRequestModal
      open={!!swapModalAssignment}
      onClose={() => setSwapModalAssignment(null)}
      myAssignment={swapModalAssignment}
    />
  </>
  );
}

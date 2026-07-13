import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowLeft,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Loader2,
  Megaphone,
  RefreshCw,
  Shield,
  SlidersHorizontal,
  User,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageLoader } from '../components/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { withRequestTimeout } from '../lib/requestTimeout';
import { supabase } from '../lib/supabase';
import type { ActivityLog } from '../types';

const container = {
  initial: {},
  animate: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } },
};

const item = {
  initial: { opacity: 0, y: 14, filter: 'blur(5px)' },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.42, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

const categoryOptions = [
  'all',
  'account',
  'organization',
  'member',
  'event',
  'attendance',
  'request',
  'announcement',
  'library',
  'setlist',
  'billing',
  'accountability',
];

const categoryMeta = {
  account: { label: 'Account', icon: User, color: '#0ea5e9' },
  organization: { label: 'Church', icon: Building2, color: '#16a34a' },
  member: { label: 'Members', icon: Users, color: '#f59e0b' },
  event: { label: 'Events', icon: CalendarDays, color: '#10b981' },
  attendance: { label: 'Attendance', icon: ClipboardCheck, color: '#6366f1' },
  request: { label: 'Requests', icon: CheckCircle2, color: '#ec4899' },
  announcement: { label: 'Announcements', icon: Megaphone, color: '#ef4444' },
  library: { label: 'Library', icon: BookOpen, color: '#14b8a6' },
  setlist: { label: 'Setlists', icon: Activity, color: '#8b5cf6' },
  billing: { label: 'Billing', icon: CreditCard, color: '#f97316' },
  accountability: { label: 'Accountability', icon: Shield, color: '#64748b' },
  system: { label: 'System', icon: Bell, color: '#6b7280' },
};

type CategoryKey = keyof typeof categoryMeta;

function formatCategory(category: string) {
  return categoryMeta[category as CategoryKey]?.label || category.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function formatAction(action: string) {
  return action
    .split('.')
    .pop()
    ?.replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase()) || action;
}

function formatWhen(value: string) {
  try {
    return format(parseISO(value), 'MMM d, yyyy - h:mm a');
  } catch {
    return value;
  }
}

function fieldLabel(field: string) {
  return field.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function changedFields(log: ActivityLog) {
  const fields = log.metadata?.changed_fields;
  return Array.isArray(fields) ? fields.filter(Boolean).slice(0, 4) : [];
}

export function PlatformActivityLog() {
  const { isPlatformOwner, organization, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const churchId = organization?.id || profile?.org_id || null;

  const loadLogs = useCallback(async (
    mode: 'initial' | 'refresh' = 'initial',
    options: { notifyOnError?: boolean } = {},
  ) => {
    const notifyOnError = options.notifyOnError ?? mode !== 'refresh';

    if (!churchId) {
      setLogs([]);
      setLoadError('No church is connected to this account yet.');
      setRefreshing(false);
      setLoading(false);
      return;
    }

    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);

    try {
      const request = supabase
        .from('activity_logs')
        .select('*')
        .eq('org_id', churchId)
        .order('created_at', { ascending: false })
        .limit(300);
      const timeoutResponse: Awaited<typeof request> = {
        data: null,
        error: {
          name: 'PostgrestError',
          message: 'Activity log took too long to load. Please refresh and try again.',
          details: '',
          hint: '',
          code: 'REQUEST_TIMEOUT',
        },
        count: null,
        status: 408,
        statusText: 'Request Timeout',
      };
      const { data, error } = await withRequestTimeout(
        request,
        timeoutResponse,
        'Platform activity log',
      );

      if (error) {
        const message = error.message || 'Failed to load activity logs';
        setLoadError(message);
        if (notifyOnError) toast('error', message);
        if (mode === 'initial') setLogs([]);
        return;
      }

      setLoadError(null);
      setLogs((data || []) as ActivityLog[]);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [churchId, toast]);

  useEffect(() => {
    if (!isPlatformOwner) return;
    document.title = 'Activity Log - ServeSync';
    loadLogs();
  }, [isPlatformOwner, loadLogs]);

  useEffect(() => {
    if (!isPlatformOwner || !churchId) return;

    const refreshVisibleLog = () => {
      if (document.visibilityState === 'visible') {
        loadLogs('refresh', { notifyOnError: false });
      }
    };

    const intervalId = window.setInterval(refreshVisibleLog, 8000);
    window.addEventListener('focus', refreshVisibleLog);
    window.addEventListener('pageshow', refreshVisibleLog);
    document.addEventListener('visibilitychange', refreshVisibleLog);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshVisibleLog);
      window.removeEventListener('pageshow', refreshVisibleLog);
      document.removeEventListener('visibilitychange', refreshVisibleLog);
    };
  }, [churchId, isPlatformOwner, loadLogs]);

  const counts = useMemo(() => {
    const next: Record<string, number> = { all: logs.length };
    logs.forEach(log => {
      next[log.category] = (next[log.category] || 0) + 1;
    });
    return next;
  }, [logs]);

  const visibleLogs = useMemo(() => {
    return logs.filter(log => {
      if (activeCategory !== 'all' && log.category !== activeCategory) return false;
      return true;
    });
  }, [activeCategory, logs]);

  if (!isPlatformOwner) {
    return (
      <div className="page-container page-bottom-pad">
        <div className="max-w-4xl mx-auto px-4 pt-8">
          <div className="rounded-3xl border border-gray-200 bg-white p-6 text-center dark:border-white/[0.06] dark:bg-white/[0.025]">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Access Restricted</h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-white/45">This log is only available to the platform owner.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return <PageLoader />;

  return (
    <div className="page-container page-bottom-pad overflow-hidden">
      <motion.div
        variants={container}
        initial="initial"
        animate="animate"
        className="max-w-3xl mx-auto px-4 sm:px-5 lg:px-6 pt-3 sm:pt-5 space-y-4"
      >
        <motion.section
          variants={item}
          className="relative overflow-hidden rounded-[1.75rem] border border-sky-200/70 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_52%,#f8fafc_100%)] p-5 shadow-[0_24px_80px_-46px_rgba(2,132,199,0.5)] dark:border-white/[0.08] dark:bg-[linear-gradient(135deg,#08121b_0%,#0d1117_52%,#080a0f_100%)] sm:p-6"
        >
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-sky-500 opacity-70 animate-ping dark:bg-sky-400" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-500 dark:bg-sky-400" />
                </span>
                <p className="text-[10px] font-mono font-black uppercase text-sky-700/75 dark:text-sky-300/70">
                  Church activity
                </p>
              </div>
              <h1 className="mt-3 text-[2.1rem] font-black leading-none text-gray-950 dark:text-white sm:text-[2.8rem]">
                Activity Log
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-white/52">
                {logs.length} recent action{logs.length === 1 ? '' : 's'} for {organization?.name || 'your church'}.
              </p>
            </div>

            <div className="grid w-full grid-cols-2 gap-2.5 sm:w-auto">
              <button
                onClick={() => navigate('/more')}
                className="h-11 px-4 rounded-2xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-sm font-semibold text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/[0.08] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                More
              </button>
              <button
                onClick={() => loadLogs('refresh', { notifyOnError: true })}
                disabled={refreshing}
                className="h-11 px-4 rounded-2xl border border-sky-200 dark:border-sky-500/20 bg-sky-50 dark:bg-sky-500/[0.08] text-sm font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-500/[0.14] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh
              </button>
            </div>
          </div>
        </motion.section>

        <motion.section variants={item} className="relative">
          <div className="relative max-w-sm">
            <SlidersHorizontal className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-white/35" />
            <select
              aria-label="Activity category"
              value={activeCategory}
              onChange={event => setActiveCategory(event.target.value)}
              className="h-12 w-full appearance-none rounded-2xl border border-gray-200 bg-white pl-11 pr-4 text-sm font-bold text-gray-800 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-500/10 dark:border-white/[0.08] dark:bg-white/[0.035] dark:text-white"
            >
              {categoryOptions.map(option => (
                <option key={option} value={option}>
                  {option === 'all' ? `All (${counts.all || 0})` : `${formatCategory(option)} (${counts[option] || 0})`}
                </option>
              ))}
            </select>
          </div>
        </motion.section>

        {loadError && (
          <motion.div
            variants={item}
            className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/[0.08] dark:text-amber-200"
          >
            {loadError}
          </motion.div>
        )}

        <motion.section variants={item} className="space-y-3">
          {visibleLogs.map(log => {
            const meta = categoryMeta[log.category as CategoryKey] || categoryMeta.system;
            const Icon = meta.icon;
            const fields = changedFields(log);
            return (
              <motion.article
                key={log.id}
                variants={item}
                className="rounded-[26px] border border-gray-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_28px_-20px_rgba(15,23,42,0.16)] dark:border-white/[0.06] dark:bg-white/[0.025] sm:p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <div
                      className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                      style={{ backgroundColor: `${meta.color}18`, color: meta.color }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-700 dark:bg-white/[0.06] dark:text-white/60">
                          {formatCategory(log.category)}
                        </span>
                        <span className="rounded-full bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-500 dark:bg-white/[0.035] dark:text-white/38">
                          {formatAction(log.action)}
                        </span>
                      </div>
                      <h2 className="mt-2 text-[15px] font-black leading-snug text-gray-950 dark:text-white">
                        {log.summary}
                      </h2>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-white/40">
                        <span>{log.actor_name || 'System'}</span>
                        {log.org_name && <span>{log.org_name}</span>}
                        {log.target_user_name && log.target_user_name !== log.actor_name && <span>Target: {log.target_user_name}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 text-left sm:text-right">
                    <p className="text-[11px] font-mono text-gray-400 dark:text-white/32">{formatWhen(log.created_at)}</p>
                    {log.entity_label && (
                      <p className="mt-1 max-w-[220px] truncate text-xs font-semibold text-gray-500 dark:text-white/40">{log.entity_label}</p>
                    )}
                  </div>
                </div>

                {(fields.length > 0 || log.metadata?.from_status || log.metadata?.to_status || log.metadata?.from_date || log.metadata?.to_date) && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3 dark:border-white/[0.06]">
                    {fields.map(field => (
                      <span key={field} className="rounded-full bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-500 dark:bg-white/[0.035] dark:text-white/38">
                        {fieldLabel(field)}
                      </span>
                    ))}
                    {log.metadata?.from_status && log.metadata?.to_status && (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:bg-amber-500/[0.12] dark:text-amber-300">
                        {fieldLabel(String(log.metadata.from_status))} to {fieldLabel(String(log.metadata.to_status))}
                      </span>
                    )}
                    {log.metadata?.from_date && log.metadata?.to_date && (
                      <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-700 dark:bg-sky-500/[0.12] dark:text-sky-300">
                        {log.metadata.from_date} to {log.metadata.to_date}
                      </span>
                    )}
                  </div>
                )}
              </motion.article>
            );
          })}

          {!loadError && visibleLogs.length === 0 && (
            <div className="rounded-[28px] border border-dashed border-gray-200 bg-white px-5 py-12 text-center dark:border-white/[0.08] dark:bg-white/[0.025]">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-500/[0.12] dark:text-sky-300">
                <Activity className="h-5 w-5" />
              </div>
              <h2 className="text-base font-black text-gray-900 dark:text-white">No activity found</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-white/40">Try another filter or check again after new activity happens.</p>
            </div>
          )}
        </motion.section>
      </motion.div>
    </div>
  );
}

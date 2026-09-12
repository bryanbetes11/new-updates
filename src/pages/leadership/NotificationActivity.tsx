import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bell, ChevronRight, RefreshCw, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { AdminPageBackLink } from '../../components/AdminPageBackLink';
import { firstNotificationOpen, pushDeliveryLabel } from '../../lib/notificationActivity';
import { NotificationActivityUsers } from './NotificationActivityUsers';

export type ActivityGroup = { group_id: string; title: string; notification_type: string; created_at: string; recipient_count: number; opened_count: number };
type Summary = { notification_count: number; member_count: number; opened_count: number; accepted_count: number; issue_count: number; failed_count: number; no_device_count: number; partial_count: number; pending_count: number; push_opened_count: number; bell_opened_count: number; page_opened_count: number };
type Insights = { summary: Summary; types: string[]; groups: ActivityGroup[]; matching_groups: number };
type Focus = 'all' | 'unopened' | 'issues';
export type ActivityRecipient = {
  notification_id: string; user_id: string; created_at: string; push_status: string | null; is_read: boolean;
  push_opened_at: string | null; bell_opened_at: string | null; page_opened_at: string | null;
  profiles: { first_name: string; last_name: string } | null;
};
const dateTime = (value: string) => new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

export function NotificationActivity() {
  const { profile, isOrgAdmin, isAdmin, isPlatformOwner } = useAuth();
  const allowed = isOrgAdmin || isAdmin || isPlatformOwner;
  const [groups, setGroups] = useState<ActivityGroup[]>([]);
  const [selected, setSelected] = useState<ActivityGroup | null>(null);
  const [recipients, setRecipients] = useState<ActivityRecipient[]>([]);
  const [page, setPage] = useState(0);
  const [memberPage, setMemberPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [days, setDays] = useState(30);
  const [type, setType] = useState('');
  const [focus, setFocus] = useState<Focus>('all');
  const [insights, setInsights] = useState<Insights | null>(null);
  const [recipientCount, setRecipientCount] = useState(0);
  const [view, setView] = useState<'notifications' | 'users'>('users');
  const since = useMemo(() => new Date(Date.now() - days * 86400000).toISOString(), [days]);
  useEffect(() => { setSelected(null); setGroups([]); setRecipients([]); setInsights(null); setType(''); setPage(0); setMemberPage(0); }, [profile?.org_id]);
  useEffect(() => {
    if (!allowed || !profile?.org_id || view === 'users') return;
    let active = true;
    setLoading(true); setError(null);
    const load = async () => {
      try {
        const { data, error: loadError } = await supabase.rpc('get_notification_activity_insights', {
          p_since: since, p_type: type || null, p_focus: focus, p_offset: page * 25, p_group: selected?.group_id || null,
        });
        if (!active) return;
        if (loadError) throw loadError;
        setInsights(data as Insights);
        if (!selected) setGroups((data as Insights).groups);
        else {
          let query = supabase.from('notification_activity')
            .select('notification_id,user_id,created_at,push_status,is_read,push_opened_at,bell_opened_at,page_opened_at,profiles!notification_activity_user_id_fkey(first_name,last_name)', { count: 'exact' })
            .eq('org_id', profile.org_id!).eq('group_id', selected.group_id).gte('created_at', since);
          if (focus === 'unopened') query = query.is('push_opened_at', null).is('bell_opened_at', null).is('page_opened_at', null);
          if (focus === 'issues') query = query.in('push_status', ['failed', 'no_subscription', 'partial']);
          const result = await query.order('user_id').range(memberPage * 50, memberPage * 50 + 49);
          if (!active) return;
          if (result.error) throw result.error;
          setRecipients((result.data || []) as unknown as ActivityRecipient[]);
          setRecipientCount(result.count || 0);
        }
      } catch {
        if (active) setError('Could not load notification activity. Check your connection and try again.');
      } finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [allowed, profile?.org_id, page, memberPage, selected, revision, since, type, focus, view]);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  if (!allowed) return <div className="page-container p-6">Notification activity is available only to church admins.</div>;
  const reset = () => { setPage(0); setMemberPage(0); };
  return <><div className="app-content-shell flex gap-2 pt-5" aria-label="Activity view">{(['users','notifications'] as const).map(value => <button type="button" key={value} aria-pressed={view === value} onClick={() => setView(value)} className={`min-h-11 rounded-xl border px-5 font-bold ${view === value ? 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'border-gray-200 dark:border-white/10'}`}>{value === 'users' ? 'Users' : 'Notifications'}</button>)}</div>
    {view === 'users' ? <NotificationActivityUsers key={profile?.org_id} orgId={profile?.org_id || ''} /> : <NotificationActivityView groups={groups} selected={selected} recipients={recipients} loading={loading} error={error}
    summary={insights?.summary} days={days} type={type} focus={focus} types={insights?.types || []}
    onDays={value => { setDays(value); setSelected(null); reset(); }}
    onType={value => { setType(value); setSelected(null); reset(); }} onFocus={value => { setFocus(value); reset(); }}
    hasNext={selected ? (memberPage + 1) * 50 < recipientCount : (page + 1) * 25 < (insights?.matching_groups || 0)}
    page={selected ? memberPage : page} onPage={selected ? setMemberPage : setPage} onRefresh={refresh}
    onSelect={group => { setSelected(group); setMemberPage(0); setRecipients([]); }} />}</>;
}

export function NotificationActivityView({ groups, selected, recipients, loading, error, page, onPage, onRefresh, onSelect,
  summary, days = 30, type = '', focus = 'all', types = [], onDays, onType, onFocus, hasNext }: {
  groups: ActivityGroup[]; selected: ActivityGroup | null; recipients: ActivityRecipient[]; loading: boolean; error: string | null;
  page: number; onPage: (page: number) => void; onRefresh: () => void; onSelect: (group: ActivityGroup | null) => void;
  summary?: Summary; days?: number; type?: string; focus?: Focus; types?: string[];
  onDays?: (value: number) => void; onType?: (value: string) => void; onFocus?: (value: Focus) => void; hasNext?: boolean;
}) {
  const canNext = hasNext ?? (selected ? (page + 1) * 50 < selected.recipient_count : groups.length === 25);
  return <div className="app-content-shell space-y-5 py-5">
    <AdminPageBackLink />
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Church admin</p>
        <h1 className="mt-1 text-3xl font-black text-gray-950 dark:text-white">Notification activity</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-500 dark:text-white/50">Check notification reach, spot delivery problems, and see who may need a follow-up.</p></div>
      <button type="button" onClick={onRefresh} disabled={loading} className="btn-secondary inline-flex min-h-11 items-center gap-2"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
    </header>
    {onDays && <div className="flex flex-wrap gap-3">
      <label className="text-xs font-bold">Period<select aria-label="Activity period" value={days} onChange={e => onDays(Number(e.target.value))} className="input-field mt-1 block min-h-11"><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label>
      <label className="min-w-0 max-w-full text-xs font-bold">Notification type<select aria-label="Notification type" value={type} onChange={e => onType?.(e.target.value)} className="input-field mt-1 block min-h-11 max-w-full"><option value="">All types</option>{types.map(value => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}</select></label>
    </div>}
    {!loading && !error && summary && <>
      <p className="text-xs font-semibold text-gray-500 dark:text-white/50">{selected ? 'This alert' : `Last ${days} days${type ? ' · selected notification type' : ''}`} · Totals include every matching record, across all pages.</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Notifications created', summary.notification_count, `${summary.member_count} distinct members`],
          ['Push accepted', summary.accepted_count, 'Accepted on at least one device'],
          ['Clicked', summary.opened_count, `${summary.notification_count ? Math.round(summary.opened_count / summary.notification_count * 100) : 0}% of notifications created`],
          ['No click recorded', summary.notification_count - summary.opened_count, 'May still have been seen or acted on'],
        ].map(([label, value, detail]) => <div key={label} className="card p-4"><p className="text-xs font-semibold text-gray-500 dark:text-white/60">{label}</p><p className="my-2 text-3xl font-black">{value}</p><p className="text-xs text-gray-500 dark:text-white/50">{detail}</p></div>)}
      </div>
      <div className="card space-y-2 p-4 text-sm">
        <p className="font-bold">{summary.issue_count ? `${summary.issue_count} notifications with a push issue` : 'No push issues recorded in this selection'}</p>
        <p className="text-gray-500 dark:text-white/60">{summary.failed_count} failed · {summary.no_device_count} without a registered device · {summary.partial_count} accepted on some devices only · {summary.pending_count} pending or deferred</p>
        <p className="text-xs text-gray-500 dark:text-white/50">Click sources: {summary.push_opened_count} push · {summary.bell_opened_count} bell · {summary.page_opened_count} notifications page. One notification can have more than one source.</p>
      </div>
    </>}
    {onFocus && <div className="flex flex-wrap gap-2" aria-label="Activity filter">{([['all', 'All activity'], ['unopened', 'No click recorded'], ['issues', 'Push issues']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={focus === value} onClick={() => onFocus(value)} className={`min-h-11 rounded-xl border px-4 text-sm font-bold ${focus === value ? 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'border-gray-200 dark:border-white/10'}`}>{label}</button>)}</div>}
    {focus !== 'all' && <p className="text-sm text-gray-500 dark:text-white/60">{focus === 'issues' ? 'Check device setup for members without a subscription. Review failed or partial delivery before sending another alert.' : 'Use this list to decide whether a personal follow-up is needed. Check availability or the requested action before reminding someone.'} Summary totals stay unchanged by this filter.</p>}
    <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4 text-sm leading-6 text-gray-600 dark:text-white/60">
      Counts cover tracked notifications created for recipients, not messages blocked by notification settings. Historical clicks cannot be recovered. Push accepted does not prove a device displayed it. Marking an alert read does not count as a click, and a click does not confirm availability. Offline opens may be recorded later. Messenger messages are excluded.
    </p>
    {selected && <div className="space-y-3">
      <button type="button" onClick={() => onSelect(null)} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-emerald-600 dark:text-emerald-400"><ArrowLeft className="h-4 w-4" />All notifications</button>
      <h2 className="text-xl font-black text-gray-950 dark:text-white">{selected.title}</h2>
      <p className="text-sm text-gray-500 dark:text-white/50">Created {dateTime(selected.created_at)} · {selected.recipient_count} recipients</p>
    </div>}
    {error ? <div role="alert" className="card p-6"><p>{error}</p><button type="button" onClick={onRefresh} className="btn-secondary mt-3">Try again</button></div>
      : loading ? <p role="status" className="card p-8 text-center">Loading notification activity…</p>
      : selected ? <div className="card divide-y divide-gray-100 overflow-hidden dark:divide-white/10">
        {recipients.length === 0 ? <p className="p-6 text-gray-500">No recipients match this filter.</p> : recipients.map(recipient => <article key={recipient.notification_id} className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
          <div><h3 className="font-bold text-gray-950 dark:text-white">{recipient.profiles ? `${recipient.profiles.first_name} ${recipient.profiles.last_name}` : 'Member unavailable'}</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-white/50">{pushDeliveryLabel(recipient.push_status)}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-white/50">{recipient.is_read ? 'Marked as read' : 'Not marked as read'}</p></div>
          <div className="text-sm">{firstNotificationOpen(recipient)
            ? <><p className="font-bold text-emerald-600 dark:text-emerald-400">First open recorded {dateTime(firstNotificationOpen(recipient)!)}</p>
              {([['Push', recipient.push_opened_at], ['Notification bell', recipient.bell_opened_at], ['Notifications page', recipient.page_opened_at]] as const)
                .filter(([, at]) => at).map(([source, at]) => <p key={source} className="mt-1 text-xs text-gray-500 dark:text-white/50">{source} · {dateTime(at!)}</p>)}</>
            : <p className="font-semibold text-gray-500 dark:text-white/50">No open recorded</p>}</div>
        </article>)}
      </div> : groups.length ? <div className="space-y-3">{groups.map(group => <button type="button" key={group.group_id} onClick={() => onSelect(group)} className="card flex w-full items-center gap-4 p-4 text-left transition hover:border-emerald-500/40 sm:p-5">
        <span className="rounded-xl bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-400"><Bell className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1"><span className="block font-bold text-gray-950 dark:text-white">{group.title}</span>
          <span className="mt-1 block text-xs text-gray-500 dark:text-white/50">{dateTime(group.created_at)} · {group.notification_type.replace(/_/g, ' ')}</span>
          <span className="mt-2 block text-sm text-gray-600 dark:text-white/70">{group.recipient_count} recipients · {group.opened_count} opened · {group.recipient_count - group.opened_count} without an open</span></span>
        <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
      </button>)}<p className="text-xs text-gray-500 dark:text-white/40">Identical alerts created together are grouped. Separately sent or personalized alerts may appear separately.</p></div>
      : <div className="card px-6 py-12 text-center"><Users className="mx-auto h-9 w-9 text-emerald-500" /><h2 className="mt-4 text-lg font-bold">No notifications match this selection</h2><p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-white/50">Try another period or filter. New tracked notifications appear here when you refresh.</p></div>}
    {!loading && !error && (page > 0 || canNext) && <nav aria-label="Activity pages" className="flex items-center justify-between gap-3"><button type="button" disabled={page === 0} onClick={() => onPage(page - 1)} className="btn-secondary">Previous</button><span className="text-sm">Page {page + 1}</span><button type="button" disabled={!canNext} onClick={() => onPage(page + 1)} className="btn-secondary">Next</button></nav>}
  </div>;
}

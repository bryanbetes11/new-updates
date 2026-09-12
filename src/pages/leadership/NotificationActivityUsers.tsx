import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, RefreshCw, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { AdminPageBackLink } from '../../components/AdminPageBackLink';
import { firstNotificationOpen, pushDeliveryLabel } from '../../lib/notificationActivity';
import { notificationOutcomeLabel, type NotificationOutcome } from '../../lib/notificationOutcome';

type UserActivity = { user_id: string; display_name: string; notification_count: number; clicked_count: number; accepted_count: number; issue_count: number; last_notification_at: string; needs_response_count: number; responded_count: number; viewed_count: number };
type UserNotification = NotificationOutcome & { notification_id: string; title: string; created_at: string; push_status: string | null; push_opened_at: string | null; bell_opened_at: string | null; page_opened_at: string | null };
const dateTime = (value: string) => new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

export function NotificationActivityUsers({ orgId }: { orgId: string }) {
  const [days, setDays] = useState(30);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UserActivity[]>([]);
  const [selected, setSelected] = useState<UserActivity | null>(null);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [focus, setFocus] = useState('all');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const since = useMemo(() => new Date(Date.now() - days * 86400000).toISOString(), [days]);
  useEffect(() => { const timer = window.setTimeout(() => { setQuery(search.trim()); setPage(0); }, 250); return () => window.clearTimeout(timer); }, [search]);
  useEffect(() => {
    if (!orgId) return;
    let active = true;
    setLoading(true); setError(false);
    const load = async () => {
      try {
        if (selected) {
          let request = supabase.from('notification_activity_outcomes')
            .select('notification_id,title,created_at,push_status,push_opened_at,bell_opened_at,page_opened_at,event_viewed_at,response_status', { count: 'exact' })
            .eq('org_id', orgId).eq('user_id', selected.user_id).gte('created_at', since);
          if (focus === 'unopened') request = request.is('push_opened_at', null).is('bell_opened_at', null).is('page_opened_at', null);
          if (focus === 'issues') request = request.in('push_status', ['failed','no_subscription','partial']);
          if (focus === 'followup') request = request.eq('response_status', 'awaiting_response');
          const result = await request.order('created_at', { ascending: false }).order('notification_id').range(page * 25, page * 25 + 24);
          if (result.error) throw result.error;
          if (active) { setNotifications(result.data || []); setTotal(result.count || 0); }
        } else {
          const result = await supabase.rpc('get_notification_activity_users', { p_since: since, p_search: query, p_offset: page * 25 });
          if (result.error) throw result.error;
          if (active) { setUsers(result.data.users); setTotal(result.data.total); }
        }
      } catch { if (active) setError(true); }
      finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [orgId, since, query, page, selected, focus, revision]);
  return <div className="app-content-shell space-y-3 py-3">
    <AdminPageBackLink />
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-black">Notification activity</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-white/60">Notification reach and recorded clicks, by person.</p></div>
      <button className="btn-secondary inline-flex min-h-11 items-center gap-2" disabled={loading} onClick={() => setRevision(value => value + 1)}><RefreshCw className="h-4 w-4" />Refresh</button>
    </header>
    <div className="flex flex-wrap gap-3">
      <label className="text-xs font-bold">Period<select className="input-field mt-1 block min-h-11" value={days} onChange={e => { setDays(Number(e.target.value)); setPage(0); setSelected(null); }}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label>
      {!selected && <label className="min-w-0 flex-1 text-xs font-bold">Search users<input className="input-field mt-1 block min-h-11 w-full" placeholder="Search by name" value={search} onChange={e => setSearch(e.target.value)} /></label>}
    </div>
    {selected ? <div className="space-y-3">
      <button className="inline-flex min-h-11 items-center gap-2 font-bold text-emerald-600 dark:text-emerald-400" onClick={() => { setSelected(null); setPage(0); setFocus('all'); }}><ArrowLeft className="h-4 w-4" />All users</button>
      <h2 className="text-2xl font-black">{selected.display_name}</h2>
      <div className="flex flex-wrap gap-2">{[['all','All notifications'],['followup','Needs response'],['unopened','No click recorded'],['issues','Push issues']].map(([value,label]) => <button key={value} aria-pressed={focus === value} className={`min-h-11 rounded-xl border px-4 text-sm font-bold ${focus === value ? 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'border-gray-200 dark:border-white/10'}`} onClick={() => { setFocus(value); setPage(0); }}>{label}</button>)}</div>
    </div> : <p className="text-xs text-gray-500 dark:text-white/50">Users with activity in the last {days} days. Select a name for individual alerts.</p>}
    <details className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 text-xs text-gray-600 dark:text-white/60">
      <summary className="min-h-11 cursor-pointer py-3 font-semibold text-emerald-700 dark:text-emerald-400">What does “0 recorded clicks” mean?</summary>
      <p className="pb-3 leading-5">For event invitations, assignments and reschedules, use Viewed update, Responded and Needs response. These count matching notification records, so reminders for one event can contribute more than once. Opening the relevant event directly can record a view without a notification click. Views start with this app update; historical views are unknown. A view means the event was displayed, not proof it was read. Responses come from current assignments. Older schedule notifications are excluded from follow-up. Other notification types still use click tracking.</p>
    </details>
    {error ? <div role="alert" className="card p-5">Could not load user activity. Please try Refresh.</div>
      : loading ? <p role="status" className="card p-6">Loading user activity…</p>
      : <><p className="text-sm font-semibold">{total} {selected ? 'notifications' : 'users'} match this selection</p>
      {total === 0 ? <div className="card p-8 text-center"><Users className="mx-auto mb-3 h-7 w-7 text-emerald-500" />{selected ? 'No notifications match this filter.' : 'No users match this period and search.'}</div>
        : selected ? <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10">
          <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,.8fr)_minmax(0,1.2fr)] gap-4 bg-gray-50 px-4 py-2.5 text-xs font-semibold text-gray-500 dark:bg-white/5 dark:text-white/50 md:grid"><span>Notification / created</span><span>Push delivery</span><span>Response & activity</span></div>
          {notifications.map(row => <article key={row.notification_id} className="grid gap-2 border-t border-gray-100 px-4 py-3 first:border-t-0 dark:border-white/5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,.8fr)_minmax(0,1.2fr)] md:items-start md:gap-4">
          <div className="min-w-0"><h3 className="text-sm font-semibold leading-5">{row.title}</h3><p className="mt-1 text-[11px] text-gray-500 dark:text-white/40">{dateTime(row.created_at)}</p></div>
          <div><span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-medium ${['failed','no_subscription','partial'].includes(row.push_status || '') ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-white/60'}`}>{pushDeliveryLabel(row.push_status)}</span></div>
          <div className="min-w-0 space-y-1">
          {notificationOutcomeLabel(row) && <p className={`text-xs font-semibold ${row.response_status === 'awaiting_response' ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{notificationOutcomeLabel(row)}</p>}
          {row.event_viewed_at && <p className="text-[11px] text-gray-500 dark:text-white/50">Viewed in app · {dateTime(row.event_viewed_at)}</p>}
          <p className="text-xs text-gray-500 dark:text-white/50">{firstNotificationOpen(row) ? `First click · ${dateTime(firstNotificationOpen(row)!)}` : 'No click recorded'}</p>
          {firstNotificationOpen(row) && <details className="text-[11px] text-gray-500 dark:text-white/50"><summary className="min-h-11 cursor-pointer py-3 md:min-h-0 md:py-1">Click sources</summary>{([['Push',row.push_opened_at],['Bell',row.bell_opened_at],['Notifications page',row.page_opened_at]] as const).filter(([,at]) => at).map(([source,at]) => <p key={source} className="py-1">{source} · {dateTime(at!)}</p>)}</details>}
          </div>
        </article>)}</div>
        : <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10">
          <div className="hidden grid-cols-[minmax(220px,2fr)_repeat(5,minmax(0,1fr))_16px] items-center gap-3 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 dark:bg-white/5 dark:text-white/50 lg:grid"><span>User / latest notification</span>{['Created','Viewed update','Responded','Needs response','Push issues'].map(label => <span key={label} className="text-center">{label}</span>)}<span /></div>
          {users.map(user => <button key={user.user_id} onClick={() => { setSelected(user); setPage(0); setFocus('all'); }} className="grid w-full grid-cols-[1fr_16px] items-center gap-x-3 gap-y-2 border-t border-gray-100 px-4 py-3 text-left transition first:border-t-0 hover:bg-emerald-500/5 dark:border-white/5 lg:grid-cols-[minmax(220px,2fr)_repeat(5,minmax(0,1fr))_16px]">
          <span className="min-w-0"><span className="block truncate text-sm font-bold">{user.display_name}</span><span className="mt-1 block text-[11px] text-gray-500 dark:text-white/40">{dateTime(user.last_notification_at)}</span></span>
          <ChevronRight className="h-4 w-4 text-gray-400 lg:order-last" />
          <span className="col-span-2 grid grid-cols-5 gap-1 lg:contents">{[
            ['Created',user.notification_count],['Viewed update',user.viewed_count],['Responded',user.responded_count],['Needs response',user.needs_response_count],['Push issues',user.issue_count],
          ].map(([label,value]) => <span key={label} className="min-w-0 text-center"><span className="mb-1 block text-[10px] leading-3 text-gray-500 dark:text-white/50 lg:hidden">{label}</span><span className={`text-sm font-semibold tabular-nums ${label === 'Push issues' && Number(value) > 0 ? 'rounded-md bg-amber-500/10 px-2 py-1 text-amber-700 dark:text-amber-400' : label === 'Recorded clicks' && Number(value) > 0 ? 'text-emerald-600 dark:text-emerald-400' : Number(value) === 0 ? 'text-gray-400 dark:text-white/35' : ''}`}>{value}</span></span>)}</span>
        </button>)}</div>}
      {(page > 0 || (page+1)*25 < total) && <nav className="flex items-center justify-between gap-3" aria-label="User activity pages"><button className="btn-secondary" disabled={!page} onClick={() => setPage(page-1)}>Previous</button><span>Page {page+1}</span><button className="btn-secondary" disabled={(page+1)*25 >= total} onClick={() => setPage(page+1)}>Next</button></nav>}</>}
  </div>;
}

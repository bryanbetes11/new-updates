import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Bell, ChevronRight, RefreshCw, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { AdminPageBackLink } from '../../components/AdminPageBackLink';
import { firstNotificationOpen, pushDeliveryLabel } from '../../lib/notificationActivity';

export type ActivityGroup = { group_id: string; title: string; notification_type: string; created_at: string; recipient_count: number; opened_count: number };
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
  useEffect(() => { setSelected(null); setGroups([]); setRecipients([]); setPage(0); setMemberPage(0); }, [profile?.org_id]);
  useEffect(() => {
    if (!allowed || !profile?.org_id) return;
    let active = true;
    setLoading(true); setError(null);
    const load = async () => {
      try {
        const { data, error: loadError } = selected
          ? await supabase.from('notification_activity')
            .select('notification_id,user_id,created_at,push_status,is_read,push_opened_at,bell_opened_at,page_opened_at,profiles!notification_activity_user_id_fkey(first_name,last_name)')
            .eq('org_id', profile.org_id!).eq('group_id', selected.group_id)
            .order('user_id').range(memberPage * 50, memberPage * 50 + 49)
          : await supabase.rpc('get_notification_activity_groups', { p_offset: page * 25 });
        if (!active) return;
        if (loadError) throw loadError;
        if (selected) setRecipients((data || []) as unknown as ActivityRecipient[]);
        else setGroups((data || []) as ActivityGroup[]);
      } catch {
        if (active) setError('Could not load notification activity. Check your connection and try again.');
      } finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [allowed, profile?.org_id, page, memberPage, selected, revision]);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  if (!allowed) return <div className="page-container p-6">Notification activity is available only to church admins.</div>;
  return <NotificationActivityView groups={groups} selected={selected} recipients={recipients} loading={loading} error={error}
    page={selected ? memberPage : page} onPage={selected ? setMemberPage : setPage} onRefresh={refresh}
    onSelect={group => { setSelected(group); setMemberPage(0); setRecipients([]); }} />;
}

export function NotificationActivityView({ groups, selected, recipients, loading, error, page, onPage, onRefresh, onSelect }: {
  groups: ActivityGroup[]; selected: ActivityGroup | null; recipients: ActivityRecipient[]; loading: boolean; error: string | null;
  page: number; onPage: (page: number) => void; onRefresh: () => void; onSelect: (group: ActivityGroup | null) => void;
}) {
  const canNext = selected ? (page + 1) * 50 < selected.recipient_count : groups.length === 25;
  return <div className="app-content-shell space-y-5 py-5">
    <AdminPageBackLink />
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Church admin</p>
        <h1 className="mt-1 text-3xl font-black text-gray-950 dark:text-white">Notification activity</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-500 dark:text-white/50">See who opened an alert, when it was first recorded, and where they opened it.</p></div>
      <button type="button" onClick={onRefresh} disabled={loading} className="btn-secondary inline-flex min-h-11 items-center gap-2"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
    </header>
    <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4 text-sm leading-6 text-gray-600 dark:text-white/60">
      Tracking starts with new notifications; past clicks cannot be recovered. Push accepted means the push service accepted delivery—not that it appeared on a device. Opening the bell or marking an alert read does not count as clicking it. Offline opens may be recorded later.
    </p>
    {selected && <div className="space-y-3">
      <button type="button" onClick={() => onSelect(null)} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-emerald-600 dark:text-emerald-400"><ArrowLeft className="h-4 w-4" />All notifications</button>
      <h2 className="text-xl font-black text-gray-950 dark:text-white">{selected.title}</h2>
      <p className="text-sm text-gray-500 dark:text-white/50">Created {dateTime(selected.created_at)} · {selected.recipient_count} recipients</p>
    </div>}
    {error ? <div role="alert" className="card p-6"><p>{error}</p><button type="button" onClick={onRefresh} className="btn-secondary mt-3">Try again</button></div>
      : loading ? <p role="status" className="card p-8 text-center">Loading notification activity…</p>
      : selected ? <div className="card divide-y divide-gray-100 overflow-hidden dark:divide-white/10">
        {recipients.length === 0 ? <p className="p-6 text-gray-500">No recipient activity remains for this alert.</p> : recipients.map(recipient => <article key={recipient.notification_id} className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
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
      : <div className="card px-6 py-12 text-center"><Users className="mx-auto h-9 w-9 text-emerald-500" /><h2 className="mt-4 text-lg font-bold">No tracked notifications yet</h2><p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-white/50">New notifications will appear here automatically. Choose an alert to see its recipients and recorded opens.</p></div>}
    {!loading && !error && (page > 0 || canNext) && <nav aria-label="Activity pages" className="flex items-center justify-between gap-3"><button type="button" disabled={page === 0} onClick={() => onPage(page - 1)} className="btn-secondary">Previous</button><span className="text-sm">Page {page + 1}</span><button type="button" disabled={!canNext} onClick={() => onPage(page + 1)} className="btn-secondary">Next</button></nav>}
  </div>;
}

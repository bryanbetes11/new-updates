import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { groupInactiveAssignments } from '../lib/inactiveAssignments';
import { groupDeclinedAssignments, type DeclinedAssignmentGroups, type DeclinedAssignmentRow } from '../lib/declinedAssignments';
import { hasEventScheduleEnded, isEventCompleted } from '../lib/eventLifecycle';
import { BADGE_COUNTS_REFRESH_EVENT } from '../lib/realtimeSignals';
import type { Event } from '../types';

export function useEventAssignmentIssues(events: Event[], refreshKey = '') {
  const { user, profile, isLeader, isOrgAdmin, isPlatformOwner, isViewingAsMember, isViewingAsSongLeader, offlineMode } = useAuth();
  const allowed = (isLeader || isOrgAdmin || isPlatformOwner) && !isViewingAsMember && !isViewingAsSongLeader;
  const orgId = profile?.id === user?.id ? profile?.org_id : null;
  const relevant = events.filter(event => event.org_id === orgId);
  const ids = JSON.stringify(relevant.map(event => event.id).sort());
  const scope = orgId && user?.id ? JSON.stringify([user.id, orgId, ids]) : null;
  const [result, setResult] = useState<{ scope: string; groups: ReturnType<typeof groupInactiveAssignments>; declined: DeclinedAssignmentGroups; failed: boolean } | null>(null);
  useEffect(() => {
    if (!scope || !orgId || ids === '[]' || offlineMode) return;
    let disposed = false;
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      try {
        const rows: DeclinedAssignmentRow[] = [];
        const eventIds = JSON.parse(ids) as string[];
        for (let batch = 0; batch < eventIds.length; batch += 100) {
          for (let offset = 0; ; offset += 1000) {
            const { data, error } = await supabase.from('event_assignments')
              .select('event_id, user_id, status, decline_reason, profiles(first_name, last_name, ministry_status)')
              .eq('org_id', orgId)
              .in('event_id', eventIds.slice(batch, batch + 100))
              .order('id').range(offset, offset + 999).abortSignal(request.signal);
            if (error) throw error;
            rows.push(...(data || []));
            if (!data || data.length < 1000) break;
          }
        }
        if (!disposed && !request.signal.aborted) setResult({ scope, groups: groupInactiveAssignments(rows), declined: groupDeclinedAssignments(rows), failed: false });
      } catch {
        if (!disposed && !request.signal.aborted) setResult({ scope, groups: {}, declined: {}, failed: true });
      }
    };
    const refresh = () => { clearTimeout(timer); timer = setTimeout(() => { void load(); }, 150); };
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    void load();
    const channel = supabase.channel(`assignment-issues-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `org_id=eq.${orgId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_assignments', filter: `org_id=eq.${orgId}` }, refresh)
      .subscribe();
    window.addEventListener('focus', refresh);
    window.addEventListener(BADGE_COUNTS_REFRESH_EVENT, refresh);
    document.addEventListener('visibilitychange', onVisible);
    // DELETE notifications can lack org_id; recheck visible pages as a fallback.
    const refreshInterval = setInterval(onVisible, 30_000);
    return () => {
      disposed = true; controller?.abort(); clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener(BADGE_COUNTS_REFRESH_EVENT, refresh);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(refreshInterval);
      void supabase.removeChannel(channel);
    };
  }, [scope, orgId, ids, refreshKey, offlineMode]);
  const current = result?.scope === scope ? result : null;
  const valid = Boolean(scope && !offlineMode && current && !current.failed);
  const futureIds = new Set(relevant.filter(event => !isEventCompleted(event) && !hasEventScheduleEnded(event)).map(event => event.id));
  return {
    groups: allowed && valid ? Object.fromEntries(Object.entries(current!.groups).filter(([eventId]) => futureIds.has(eventId))) : {},
    declined: valid ? current!.declined : {},
    availabilityState: (scope && relevant.length ? offlineMode || current?.failed ? 'unavailable' : current ? 'ready' : 'loading' : 'ready') as 'ready' | 'loading' | 'unavailable',
    unavailable: Boolean(allowed && scope && relevant.length && (offlineMode || current?.failed)),
  };
}

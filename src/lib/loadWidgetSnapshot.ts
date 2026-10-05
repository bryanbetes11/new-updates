import { supabase } from './supabase';
import { assignmentCards, widgetEventLabel, widgetText, widgetToday, type WidgetAssignment, type WidgetEvent, type WidgetSnapshot } from './widgetSnapshot';

type WidgetSetlist = {
  id: string; events: WidgetEvent | null;
  setlist_songs: { position: number; performed_key: string; songs: { title: string; song_key: string } | null }[];
};

export async function loadWidgetSnapshot(userId: string, orgId: string, scope: string, churchName: string, signal: AbortSignal, client = supabase): Promise<WidgetSnapshot> {
  const today = widgetToday();
  const assignmentSelect = 'id,user_id,status,events!inner(id,org_id,title,event_date,start_time,lifecycle_override),roles(name)';
  const [assignments, pending, setlists, announcements] = await Promise.all([
    client.from('event_assignments').select(assignmentSelect).eq('user_id', userId)
      .eq('events.org_id', orgId).gte('events.event_date', today).neq('status', 'declined')
      .order('events(event_date)', { ascending: true }).order('events(start_time)', { ascending: true }).limit(200).abortSignal(signal),
    client.from('event_assignments').select(assignmentSelect, { count: 'exact' }).eq('user_id', userId)
      .eq('events.org_id', orgId).eq('status', 'pending')
      .order('events(event_date)', { ascending: true }).order('events(start_time)', { ascending: true }).limit(200).abortSignal(signal),
    client.from('setlists').select('id,events!inner(id,org_id,title,event_date,start_time,lifecycle_override),setlist_songs(position,performed_key,songs(title,song_key))')
      .eq('org_id', orgId).eq('events.org_id', orgId).eq('status', 'approved').gte('events.event_date', today)
      .order('events(event_date)', { ascending: true }).order('events(start_time)', { ascending: true }).limit(40).abortSignal(signal),
    // Home screens are visible to others: only ordinary church announcements,
    // never leadership-only content, message text, or private member notes.
    client.from('announcements').select('id,title,content,created_at').eq('org_id', orgId)
      .or('is_leaders_only.is.null,is_leaders_only.eq.false').order('created_at', { ascending: false }).limit(12).abortSignal(signal),
  ]);
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  const unavailable = [assignments.error && 'assignments', pending.error && 'pending', setlists.error && 'setlists', announcements.error && 'announcements'].filter(Boolean) as string[];
  return {
    scope, updatedAt: Date.now(), churchName: widgetText(churchName, 80), unavailable,
    assignments: assignments.error ? [] : assignmentCards((assignments.data || []) as unknown as WidgetAssignment[], userId, orgId, today),
    pending: pending.error ? [] : assignmentCards((pending.data || []) as unknown as WidgetAssignment[], userId, orgId, today, true),
    pendingCount: pending.error ? 0 : pending.count ?? 0,
    setlists: setlists.error ? [] : ((setlists.data || []) as unknown as WidgetSetlist[])
      .filter(row => row.events?.org_id === orgId && row.events.lifecycle_override !== 'completed')
      .map(row => ({ id: row.events!.id, title: widgetText(row.events!.title), subtitle: widgetEventLabel(row.events!),
        detail: `${row.setlist_songs.length} songs · Approved`, route: `/events/${row.events!.id}`, date: row.events!.event_date,
        items: [...row.setlist_songs].sort((a, b) => a.position - b.position).slice(0, 30)
          .map(song => `${widgetText(song.songs?.title || 'Song', 70)}${song.performed_key || song.songs?.song_key ? ` · ${widgetText(song.performed_key || song.songs?.song_key, 12)}` : ''}`),
      })),
    announcements: announcements.error ? [] : (announcements.data || []).map(row => ({
      id: row.id, title: widgetText(row.title), subtitle: 'Church news', detail: widgetText(row.content, 220), route: `/announcements/${row.id}`,
    })),
  };
}

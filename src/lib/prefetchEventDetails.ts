import type { Event, Setlist, SetlistSong } from '../types';
import { readSavedEventDetail, savedEventDetailKey, type SavedEventDetail } from './offlineEvent';
import { invalidateDeviceSnapshots, writeDeviceSnapshot } from './deviceCache';
import { supabase } from './supabase';
import { resolveSetlistEvent } from './sharedSetlist';

type ApprovedSetlist = Setlist & { setlist_songs?: SetlistSong[] };

/** Save the events closest to today, including their approved charts, while online. */
export async function prefetchEventDetails(scope: string | null, userId: string | null | undefined, events: Event[]): Promise<void> {
  if (!scope || !userId || events.length === 0) return;
  const startedAt = Date.now();
  const today = new Date().toISOString().slice(0, 10);
  const selected = events.slice().sort((left, right) =>
    Math.abs(Date.parse(left.event_date) - Date.parse(today)) - Math.abs(Date.parse(right.event_date) - Date.parse(today))
  ).slice(0, 80);
  const ids = [...new Set(selected.flatMap(event => [event.id, event.linked_event_id].filter((id): id is string => !!id)))];
  const [setlistsResponse, assignmentsResponse] = await Promise.all([
    supabase.from('setlists')
      .select('*, setlist_songs(*, songs(*))')
      .eq('status', 'approved')
      .in('event_id', ids)
      .order('created_at', { ascending: false }),
    supabase.from('event_assignments')
      .select('event_id, status, roles(name)')
      .eq('user_id', userId)
      .in('event_id', selected.map(event => event.id)),
  ]);
  if (setlistsResponse.error || assignmentsResponse.error) return;
  const approved = new Map<string, ApprovedSetlist>();
  for (const row of (setlistsResponse.data || []) as unknown as ApprovedSetlist[]) {
    if (row.event_id && !approved.has(row.event_id)) approved.set(row.event_id, row);
  }
  const pendingEvents = new Set<string>();
  const songLeaderEvents = new Set<string>();
  for (const assignment of assignmentsResponse.data || []) {
    if (assignment.status === 'pending') pendingEvents.add(assignment.event_id);
    const role = Array.isArray(assignment.roles) ? assignment.roles[0] : assignment.roles;
    if (role?.name === 'Song Leader') songLeaderEvents.add(assignment.event_id);
  }
  const eventById = new Map(events.map(event => [event.id, event]));
  for (const event of selected) {
    if (pendingEvents.has(event.id) && !songLeaderEvents.has(event.id)) {
      await invalidateDeviceSnapshots(scope, [savedEventDetailKey(event.id)]);
      continue;
    }
    const current = await readSavedEventDetail(scope, event.id);
    if (current && current.savedAt >= startedAt) continue;
    const linkedEvent = event.linked_event_id ? eventById.get(event.linked_event_id) : null;
    let owner: Event;
    try { owner = resolveSetlistEvent(event, linkedEvent); }
    catch { continue; } // Do not overwrite a verified snapshot with an unresolved link.
    const setlist = approved.get(owner.id) || null;
    const snapshot: SavedEventDetail = {
      event,
      approvedSetlist: setlist,
      approvedSongs: setlist?.setlist_songs || [],
      linkedApprovedSetlist: null,
      linkedApprovedSongs: [],
      linkedServiceTitle: owner.id !== event.id ? owner.title : null,
      linkedServiceEvent: owner.id !== event.id ? owner : null,
    };
    await writeDeviceSnapshot(scope, savedEventDetailKey(event.id), snapshot);
  }
}

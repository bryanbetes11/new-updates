import type { Event, Setlist, SetlistSong } from '../types';
import { readDeviceSnapshot, writeDeviceSnapshot } from './deviceCache';
import type { ChordProLine } from './chordPro';

/** Only approved charts may be advertised as available for offline Live Mode. */
export interface SavedEventDetail {
  event: Event | null;
  approvedSetlist: Setlist | null;
  approvedSongs: SetlistSong[];
  linkedApprovedSetlist?: Setlist | null;
  linkedApprovedSongs?: SetlistSong[];
  linkedServiceTitle?: string | null;
}

export function savedEventDetailKey(eventId: string): string {
  return `events:detail:${eventId}`;
}

export function getSavedEventSongs(snapshot: SavedEventDetail): SetlistSong[] {
  const rehearsalLinked = snapshot.event?.event_type === 'Rehearsals'
    && snapshot.linkedApprovedSetlist?.status === 'approved'
    && snapshot.linkedApprovedSongs?.length;
  const source = rehearsalLinked ? snapshot.linkedApprovedSongs! : snapshot.approvedSetlist?.status === 'approved' ? snapshot.approvedSongs : [];
  return source.filter(song => song && typeof song === 'object')
    .slice().sort((left, right) => (left.position || 0) - (right.position || 0));
}

export function getSavedSongChartText(song: SetlistSong): string {
  return song.arrangement_chordpro_text?.trim() || song.songs?.chordpro_text?.trim() || song.songs?.lyrics?.trim() || '';
}

export function getSavedEventChartCount(snapshot: SavedEventDetail): number {
  return getSavedEventSongs(snapshot).filter(song => !!getSavedSongChartText(song)).length;
}

function sectionPrefix(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes('pre') && normalized.includes('chorus')) return 'PC';
  if (normalized.includes('intro') || normalized.includes('interlude')) return 'I';
  if (normalized.includes('verse')) return 'V';
  if (normalized.includes('chorus')) return 'C';
  if (normalized.includes('bridge')) return 'B';
  if (normalized.includes('tag')) return 'T';
  if (normalized.includes('outro')) return 'O';
  if (normalized.includes('ending')) return 'E';
  return (label.match(/[a-z0-9]/i)?.[0] || 'S').toUpperCase();
}

/** Apply the same section tokens used by the online chart viewer, including repeats. */
export function arrangeSavedChartLines(lines: ChordProLine[], order: string[] | null | undefined): ChordProLine[] {
  if (!order?.length) return lines;
  const sections: ChordProLine[][] = [];
  for (const line of lines) {
    if (line.type === 'section' || sections.length === 0) sections.push([]);
    sections[sections.length - 1].push(line);
  }
  const counts: Record<string, number> = {};
  const byCode = new Map<string, ChordProLine[]>();
  for (const section of sections) {
    const label = section[0]?.type === 'section' ? section[0].section || 'Section' : 'Song';
    const prefix = sectionPrefix(label);
    counts[prefix] = (counts[prefix] || 0) + 1;
    byCode.set(`${prefix}${counts[prefix]}`, section);
  }
  const arranged = order.map(token => byCode.get(token.toUpperCase())).filter((section): section is ChordProLine[] => !!section);
  return arranged.length ? arranged.flat() : lines;
}

export function isSavedEventDetail(value: unknown, eventId?: string): value is SavedEventDetail {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<SavedEventDetail>;
  return !!snapshot.event && typeof snapshot.event.id === 'string'
    && (!eventId || snapshot.event.id === eventId)
    && Array.isArray(snapshot.approvedSongs)
    && (snapshot.approvedSetlist === null || snapshot.approvedSetlist?.status === 'approved')
    && (!snapshot.linkedApprovedSetlist || snapshot.linkedApprovedSetlist.status === 'approved')
    && (snapshot.linkedApprovedSongs === undefined || Array.isArray(snapshot.linkedApprovedSongs));
}

export async function readSavedEventDetail(scope: string | null, eventId: string) {
  const saved = await readDeviceSnapshot<SavedEventDetail>(scope, savedEventDetailKey(eventId));
  return saved && isSavedEventDetail(saved.value, eventId) ? saved : null;
}

/** A readback is required because device-cache writes can be skipped when storage is unavailable. */
export async function writeVerifiedSavedEventDetail(scope: string | null, eventId: string, snapshot: SavedEventDetail) {
  if (!scope || !isSavedEventDetail(snapshot, eventId)) return null;
  await writeDeviceSnapshot(scope, savedEventDetailKey(eventId), snapshot);
  const saved = await readSavedEventDetail(scope, eventId);
  return saved && JSON.stringify(saved.value) === JSON.stringify(snapshot) ? saved : null;
}

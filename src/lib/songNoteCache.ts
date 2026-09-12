import { supabase } from './supabase';

export type SongNoteRow = { song_id: string; section_key: string; note: string; id?: string; section_label?: string };
type Kind = 'team' | 'private';
type Entry = { rows?: SongNoteRow[]; request?: Promise<SongNoteRow[]>; version: number; listeners: Set<(rows: SongNoteRow[]) => void> };
const cache = new Map<string, Entry>();
const identity = (kind: Kind, org: string, user: string, song: string) => JSON.stringify([kind, org, user, song]);
function entry(kind: Kind, org: string, user: string, song: string) {
  const key = identity(kind, org, user, song);
  let value = cache.get(key);
  if (!value) { value = { version: 0, listeners: new Set() }; cache.set(key, value); }
  return value;
}

export function cachedSongNotes(kind: Kind, org: string, user: string, song: string) {
  return cache.get(identity(kind, org, user, song))?.rows;
}

function loadBatch(kind: Kind, org: string, user: string, songs: string[], refresh = false) {
  const targets = [...new Set(songs)].map(song => ({ song, value: entry(kind, org, user, song) }))
    .filter(({ value }) => !value.request && (refresh || !value.rows));
  if (!targets.length) return;
  const versions = targets.map(({ value }) => value.version);
  const request = Promise.resolve().then(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const rows: SongNoteRow[] = [];
      for (let offset = 0; ; offset += 500) {
      const query = kind === 'team'
        ? supabase.from('song_section_notes').select('song_id,id,section_key,section_label,note').eq('scope', 'team')
        : supabase.from('private_song_notes').select('song_id,section_key,note').eq('user_id', user);
      const { data, error } = await query.in('song_id', targets.map(target => target.song)).order('song_id').order('section_key').range(offset, offset + 499).abortSignal(controller.signal);
      if (error) throw error;
      rows.push(...(data || []) as SongNoteRow[]);
      if (!data || data.length < 500) return rows;
      }
    } finally { clearTimeout(timer); }
  });
  targets.forEach(({ song, value }, index) => {
    const pending = request.then(rows => {
      if (value.version === versions[index]) {
        value.rows = rows.filter(row => row.song_id === song);
        value.listeners.forEach(listener => listener(value.rows!));
      }
      return value.rows || [];
    }).finally(() => { if (value.request === pending) value.request = undefined; });
    value.request = pending;
    // Prefetch is best effort; visible readers expose any load failure themselves.
    void pending.catch(() => {});
  });
}

export function preloadSongNotes(org: string | null | undefined, user: string | undefined, songs: string[], refresh = false) {
  if (!org || !user) return;
  // Bound each request while loading the entire set, not just adjacent panels.
  for (let offset = 0; offset < songs.length; offset += 40) {
    loadBatch('team', org, user, songs.slice(offset, offset + 40), refresh);
    loadBatch('private', org, user, songs.slice(offset, offset + 40), refresh);
  }
}

export async function refreshSetSongNotes(org: string, user: string, songs: string[]) {
  preloadSongNotes(org, user, songs, true);
  await Promise.all(songs.flatMap(song => (['team', 'private'] as const).map(kind => entry(kind, org, user, song).request)));
}

export function subscribeSongNotes(kind: Kind, org: string, user: string, song: string, listener: (rows: SongNoteRow[]) => void) {
  const value = entry(kind, org, user, song);
  value.listeners.add(listener);
  return () => { value.listeners.delete(listener); };
}

export async function loadSongNotes(kind: Kind, org: string, user: string, song: string, refresh = false) {
  const value = entry(kind, org, user, song);
  if (!refresh && value.rows) return value.rows;
  loadBatch(kind, org, user, [song], refresh);
  return value.request || value.rows || [];
}

export function updateCachedSongNote(kind: Kind, org: string, user: string, song: string, section: string, row: SongNoteRow | null) {
  const value = entry(kind, org, user, song);
  value.version++;
  value.rows = (value.rows || []).filter(note => note.section_key !== section);
  if (row) value.rows.push(row);
  value.listeners.forEach(listener => listener(value.rows!));
}

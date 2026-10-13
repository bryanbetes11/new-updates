export interface VideoSetlist {
  id: string;
  status: string;
  event_id: string;
  events?: { title: string; event_date: string; event_type: string } | null;
  setlist_songs?: Array<{
    id: string;
    position: number;
    performed_key?: string | null;
    songs?: { title: string; artist?: string | null; song_key?: string | null } | null;
  }> | null;
}

export type VideoSetlistMatch =
  | { kind: 'matched'; setlist: VideoSetlist }
  | { kind: 'ambiguous'; setlists: VideoSetlist[] }
  | { kind: 'unmatched'; date: string | null };

const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const namedDatePattern = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2}),?\s+(\d{4})\b/i;
const isoDatePattern = /\b(\d{4})-(\d{2})-(\d{2})\b/;

function validDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Recording dates come from the title, never from a potentially later upload date. */
export function getVideoServiceDate(title: string): string | null {
  const named = title.match(namedDatePattern);
  if (named) return validDate(Number(named[3]), monthNames.indexOf(named[1].slice(0, 3).toLowerCase()) + 1, Number(named[2]));
  const iso = title.match(isoDatePattern);
  return iso ? validDate(Number(iso[1]), Number(iso[2]), Number(iso[3])) : null;
}

function normalizeLabel(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\b(?:sister|sis|brother|bro)\b\.?\s*/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

function containsLabel(text: string, label: string) {
  return !!label && ` ${text} `.includes(` ${label} `);
}

export function matchVideoSetlist(title: string, setlists: VideoSetlist[]): VideoSetlistMatch {
  const date = getVideoServiceDate(title);
  if (!date) return { kind: 'unmatched', date: null };
  const candidates = setlists.filter(setlist => setlist.status === 'approved' && setlist.events?.event_date.slice(0, 10) === date);
  if (candidates.length === 1) return { kind: 'matched', setlist: candidates[0] };
  if (candidates.length === 0) return { kind: 'unmatched', date };
  const label = normalizeLabel(title.replace(namedDatePattern, '').replace(isoDatePattern, ''));
  // A service name is stronger than a leader who may lead two services that day.
  const serviceMatches = candidates.filter(setlist => containsLabel(label, normalizeLabel(setlist.events?.event_type || '')));
  if (serviceMatches.length === 1) return { kind: 'matched', setlist: serviceMatches[0] };
  const remaining = serviceMatches.length ? serviceMatches : candidates;
  const titleMatches = remaining.filter(setlist => {
    const eventTitle = normalizeLabel(setlist.events?.title || '');
    return containsLabel(label, eventTitle) || containsLabel(eventTitle, label);
  });
  if (titleMatches.length === 1) return { kind: 'matched', setlist: titleMatches[0] };
  return { kind: 'ambiguous', setlists: titleMatches.length ? titleMatches : remaining };
}

export function getVideoSetlistSongs(setlist: VideoSetlist) {
  return [...(setlist.setlist_songs || [])].sort((a, b) => a.position - b.position);
}

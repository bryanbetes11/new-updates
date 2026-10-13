import { getVideoServiceDate, getVideoSetlistSongs, matchVideoSetlist, type VideoSetlist } from '../src/lib/videoSetlist';

function assert(value: unknown, message: string) { if (!value) throw new Error(message); }
const sunday: VideoSetlist = { id: 'sunday', event_id: 'event-1', status: 'approved', events: { title: 'Sis. Fiona Leones', event_date: '2026-09-06', event_type: 'Sunday Service' }, setlist_songs: [
  { id: 'song-2', position: 2, songs: { title: 'Living Hope' } },
  { id: 'song-1', position: 1, songs: { title: 'Goodness of God' } },
] };
const youth: VideoSetlist = { ...sunday, id: 'youth', event_id: 'event-2', events: { ...sunday.events!, event_type: 'Youth Recharge' } };
assert(getVideoServiceDate('October 11, 2026 - Sis. Fiona') === '2026-10-11', 'Full month with comma');
assert(getVideoServiceDate('Sept. 6 2026 – Worship') === '2026-09-06', 'Abbreviated month without comma');
assert(getVideoServiceDate('2026-09-06 - Sunday Service') === '2026-09-06', 'ISO recording date');
assert(getVideoServiceDate('February 29, 2026 - Worship') === null, 'Reject impossible date instead of rolling into March');
assert(getVideoServiceDate('February 29, 2024 - Worship') === '2024-02-29', 'Accept leap day');
assert(getVideoServiceDate('September 6 - Worship') === null, 'Do not guess year from upload/current date');
assert(getVideoServiceDate('Sound desk tutorial') === null, 'Undated tutorial has no recording date');
const unique = matchVideoSetlist('September 6, 2026 - Sis. Fiona', [sunday]);
assert(unique.kind === 'matched' && unique.setlist.id === 'sunday', 'Single approved set for date matches');
assert(matchVideoSetlist('September 6, 2026 - Sis. Fiona', [sunday, youth]).kind === 'ambiguous', 'Same leader at two services requires selection');
const explicit = matchVideoSetlist('September 6, 2026 - Youth Recharge - Sis. Fiona', [sunday, youth]);
assert(explicit.kind === 'matched' && explicit.setlist.id === 'youth', 'Explicit service type disambiguates');
const otherLeader = { ...youth, events: { ...youth.events!, title: 'Bro. Daniel' } };
assert(matchVideoSetlist('September 6, 2026 - Sis. Fiona', [sunday, otherLeader]).kind === 'matched', 'Short leader name can match full event title');
assert(matchVideoSetlist('September 6, 2026 - Sister Fiona', [sunday, otherLeader]).kind === 'matched', 'Full honorific normalizes like its abbreviation');
assert(matchVideoSetlist('September 6, 2026 - Worship', [sunday, youth]).kind === 'ambiguous', 'Unclear title does not pick the first set');
assert(matchVideoSetlist('September 6, 2026 - Worship', [{ ...sunday, status: 'draft' }]).kind === 'unmatched', 'Draft songs are never displayed as an approved set');
assert(matchVideoSetlist('September 7, 2026 - Worship', [sunday]).kind === 'unmatched', 'Wrong service date never matches');
assert(matchVideoSetlist('Sound desk tutorial', [sunday]).kind === 'unmatched', 'Upload date is not a service match');
const ordered = getVideoSetlistSongs(sunday);
assert(ordered[0].id === 'song-1' && ordered[1].id === 'song-2', 'Song order follows Sets');
assert(sunday.setlist_songs?.[0].id === 'song-2', 'Sorting does not mutate cached setlist');
assert(getVideoSetlistSongs({ ...sunday, setlist_songs: null }).length === 0, 'Empty set supported');

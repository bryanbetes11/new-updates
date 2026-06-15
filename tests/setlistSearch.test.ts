import { filterSetlistsBySearch } from '../src/lib/setlistSearch';

function expectIds(actual: Array<{ id: string }>, expected: string[], message: string) {
  const ids = actual.map(item => item.id);
  if (JSON.stringify(ids) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${expected.join(',')}, got ${ids.join(',')}`);
  }
}

const setlists = [
  {
    id: 'set-1',
    event_id: 'event-1',
    events: { title: 'Sunday Celebration', event_date: '2026-06-14', event_type: 'Sunday Service' },
    setlist_songs: [
      { performed_key: 'D', songs: { title: 'Living Hope', artist: 'Phil Wickham', song_key: 'D' } },
      { performed_key: 'G', songs: { title: 'Goodness of God', artist: 'Bethel Music', song_key: 'G' } },
    ],
  },
  {
    id: 'set-2',
    event_id: 'event-2',
    events: { title: 'Prayer Night', event_date: '2026-06-17', event_type: 'Prayer Meeting' },
    setlist_songs: [
      { performed_key: 'C', songs: { title: 'Build My Life', artist: 'Housefires', song_key: 'C' } },
    ],
  },
];

const songLeaderMap = {
  'event-1': 'Sis. Mika',
  'event-2': 'Bro. Daniel',
};

expectIds(filterSetlistsBySearch(setlists, '', songLeaderMap), ['set-1', 'set-2'], 'empty search keeps all sets');
expectIds(filterSetlistsBySearch(setlists, 'living hope', songLeaderMap), ['set-1'], 'matches song title');
expectIds(filterSetlistsBySearch(setlists, 'daniel', songLeaderMap), ['set-2'], 'matches song leader name');
expectIds(filterSetlistsBySearch(setlists, 'prayer', songLeaderMap), ['set-2'], 'matches event title and type');
expectIds(filterSetlistsBySearch(setlists, 'bethel', songLeaderMap), ['set-1'], 'matches song artist');

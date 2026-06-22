import { buildSongUsages } from '../src/lib/songUsage';

function expectEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

const usages = buildSongUsages({
  songs: [
    { id: 'song-1', title: '  Bro. Living Hope  ', artist: 'Phil Wickham', song_key: 'D' },
    { id: 'song-2', title: 'New Song', artist: '', song_key: 'G' },
  ],
  setlists: [
    {
      id: 'set-older',
      event_id: 'event-older',
      events: { title: 'Prayer Night', event_date: '2026-03-01', event_type: 'Prayer Meeting' },
      setlist_songs: [{ id: 'set-song-older', song_id: 'song-1', position: 1 }],
    },
    {
      id: 'set-latest',
      event_id: 'event-latest',
      events: { title: 'Sunday Worship', event_date: '2026-06-01', event_type: 'Sunday Service' },
      setlist_songs: [{ id: 'set-song-latest', song_id: 'song-1', position: 2 }],
    },
  ],
  now: new Date('2026-06-22T08:00:00+08:00'),
  ruleDays: 90,
  sanitizeTitle: title => title.replace(/Bro\.\s*/g, '').trim(),
});

const reusedSong = usages.find(song => song.id === 'song-1');
if (!reusedSong) throw new Error('expected reused song');

expectEqual(reusedSong.title, 'Living Hope', 'sanitizes song title for display');
expectEqual(reusedSong.days_since, 21, 'uses latest event date for reuse age');
expectEqual(reusedSong.is_safe, false, 'marks songs used inside the rule window as not ready');
expectEqual(reusedSong.latest_usage?.event_title, 'Sunday Worship', 'exposes latest event title');
expectEqual(reusedSong.latest_usage?.event_type, 'Sunday Service', 'exposes latest event type');
expectEqual(reusedSong.usages.length, 2, 'keeps all event usages for the song');
expectEqual(reusedSong.usages[0].event_id, 'event-latest', 'sorts usages newest first');

const newSong = usages.find(song => song.id === 'song-2');
if (!newSong) throw new Error('expected new song');

expectEqual(newSong.days_since, null, 'never-used songs have no reuse age');
expectEqual(newSong.is_safe, true, 'never-used songs are ready');
expectEqual(newSong.latest_usage, null, 'never-used songs have no event usage');

import { buildSongProposalConflicts, buildSongProposalReservations, type SongProposalSetlistRow } from '../src/lib/songProposalConflicts';

function expectEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

const rows: SongProposalSetlistRow[] = [
  {
    id: 'sarah-setlist',
    event_id: 'sarah-event',
    status: 'pending_review',
    submitted_at: '2026-08-23T16:53:03.395Z',
    events: { title: 'Sis. Sarah', event_date: '2026-08-30' },
    submitter: { first_name: 'Sarah', last_name: 'Megallon' },
    setlist_songs: [{ song_id: 'glory' }, { song_id: 'unique-song' }],
  },
  {
    id: 'fiona-setlist',
    event_id: 'fiona-event',
    status: 'approved',
    submitted_at: '2026-08-24T05:15:49.429Z',
    events: { title: 'Sis. Fiona', event_date: '2026-09-06' },
    submitter: [{ first_name: 'Fiona', last_name: 'Leones' }],
    setlist_songs: [{ song_id: 'glory' }],
  },
];

const sarahConflicts = buildSongProposalConflicts(rows, 'sarah-setlist');
expectEqual(sarahConflicts.glory.firstSubmission.submitterName, 'Sarah Megallon', 'identifies the first submitter');
expectEqual(sarahConflicts.glory.currentSubmission.setlistId, 'sarah-setlist', 'identifies the current setlist');
expectEqual(sarahConflicts.glory.totalSubmissions, 2, 'counts competing proposals');
expectEqual(sarahConflicts['unique-song'], undefined, 'does not flag a song with only one proposal');

const fionaConflicts = buildSongProposalConflicts(rows, 'fiona-setlist');
expectEqual(fionaConflicts.glory.firstSubmission.setlistId, 'sarah-setlist', 'preserves the earliest submission across later approval');
expectEqual(fionaConflicts.glory.otherSubmissions[0].submitterName, 'Sarah Megallon', 'lists the competing submitter');

const invalidRows: SongProposalSetlistRow[] = [{ ...rows[0], submitted_at: null }];
expectEqual(Object.keys(buildSongProposalConflicts(invalidRows, 'sarah-setlist')).length, 0, 'ignores unsubmitted drafts');

const sarahReservations = buildSongProposalReservations(rows, 'sarah-setlist');
expectEqual(sarahReservations.glory.firstSubmission.submitterName, 'Fiona Leones', 'warns about another proposal while excluding the current setlist');
expectEqual(sarahReservations.glory.totalSubmissions, 1, 'counts only other active proposals');

const newSetlistReservations = buildSongProposalReservations(rows, null);
expectEqual(newSetlistReservations.glory.firstSubmission.submitterName, 'Sarah Megallon', 'shows the earliest reservation for a new setlist');
expectEqual(newSetlistReservations.glory.totalSubmissions, 2, 'counts all active proposals for a new setlist');

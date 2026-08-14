import { isSetlistMeaningfullyCreated } from '../src/lib/setlistPersistence';

function expectEqual(actual: boolean, expected: boolean, message: string) {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, received ${actual}`);
}

expectEqual(isSetlistMeaningfullyCreated(null), false, 'a missing row is not a created setlist');
expectEqual(isSetlistMeaningfullyCreated({ status: 'draft', setlist_songs: [] }), false, 'an empty draft is not a created setlist');
expectEqual(isSetlistMeaningfullyCreated({ status: 'draft', setlist_songs: [{ id: 'song-1' }] }), true, 'a draft becomes meaningful after its first song');
expectEqual(isSetlistMeaningfullyCreated({ status: 'pending_review', setlist_songs: [] }), true, 'a submitted workflow state remains visible even if its songs are unexpectedly empty');
expectEqual(isSetlistMeaningfullyCreated({ status: 'approved', setlist_songs: [] }), true, 'an approved workflow state remains visible');

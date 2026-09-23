import assert from 'node:assert/strict';
import { arrangeSavedChartLines, getSavedEventSongs, getSavedSongChartText, isSavedEventDetail, type SavedEventDetail } from '../src/lib/offlineEvent';
import { parseChordPro } from '../src/lib/chordPro';
import type { Event, Setlist, SetlistSong } from '../src/types';

const event = { id: 'rehearsal', event_type: 'Rehearsals' } as Event;
const serviceSet = { id: 'service-set', status: 'approved' } as Setlist;
const linkedSongs = [
  { id: 'second', position: 2, songs: { title: 'Second', chordpro_text: '[C]Second' } },
  { id: 'first', position: 1, songs: { title: 'First', chordpro_text: '[G]First' } },
] as SetlistSong[];
const snapshot: SavedEventDetail = {
  event,
  approvedSetlist: null,
  approvedSongs: [],
  linkedApprovedSetlist: serviceSet,
  linkedApprovedSongs: linkedSongs,
};

assert.equal(isSavedEventDetail(snapshot, 'rehearsal'), true);
assert.equal(isSavedEventDetail(snapshot, 'other'), false, 'a route cannot read a different event snapshot');
assert.deepEqual(getSavedEventSongs(snapshot).map(song => song.id), ['first', 'second'], 'linked approved service is available to rehearsal in order');
assert.deepEqual(getSavedEventSongs({ ...snapshot, linkedApprovedSetlist: { ...serviceSet, status: 'draft' } }), [], 'draft linked sets are excluded');
assert.equal(getSavedSongChartText({ ...linkedSongs[0], arrangement_chordpro_text: '[D]Arrangement' }), '[D]Arrangement');

const chart = parseChordPro('{c: Verse}\n[C]First\n{c: Chorus}\n[G]Chorus\n{c: Verse}\n[D]Second');
const arranged = arrangeSavedChartLines(chart, ['C1', 'V2', 'V1']);
assert.deepEqual(arranged.filter(line => line.type === 'section').map(line => line.section), ['Chorus', 'Verse', 'Verse']);
assert.deepEqual(arrangeSavedChartLines(chart, ['missing']), chart, 'invalid arrangement tokens leave the original chart readable');

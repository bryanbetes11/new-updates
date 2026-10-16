import assert from 'node:assert/strict';
import { getCapoChartView, isCapoFret, isEventGuitarist, parsePersonalCapoSetting, personalCapoPreferenceKey, personalCapoStorageId, readPersonalCapo, writePersonalCapo } from '../src/lib/personalCapo';
import { transposeChordPro } from '../src/lib/chordPro';

const assignment = (user_id: string, name: string, status = 'confirmed') => ({ user_id, status, roles: { name } });
assert.equal(isEventGuitarist([assignment('guitar', 'Guitar')], 'guitar'), true);
for (const name of ['Acoustic Guitar', 'Electric Guitar', 'Lead Guitar', 'Rhythm Guitar', 'Guitarist', 'Guitar 2', ' guitar ']) {
  assert.equal(isEventGuitarist([assignment('guitar', name)], 'guitar'), true, `recognize ${name}`);
}
for (const name of ['Keys', 'Bass', 'Bass Guitar', 'Drums', 'Backup Vocals', 'Guitar Tech']) {
  assert.equal(isEventGuitarist([assignment('guitar', name)], 'guitar'), false, `exclude ${name}`);
}
assert.equal(isEventGuitarist([assignment('guitar', 'Guitar')], 'keys'), false, 'another guitarist does not grant capo');
assert.equal(isEventGuitarist([assignment('guitar', 'Guitar', 'declined')], 'guitar'), false);
assert.equal(isEventGuitarist([assignment('guitar', 'Guitar', 'pending')], 'guitar'), true, 'assigned guitarist can prepare a chart');
assert.equal(isEventGuitarist([assignment('guitar', 'Guitar')], undefined), false);

const view = getCapoChartView('C', 'A', null, 2, true);
assert.equal(view.shapesKey, 'G');
assert.equal(view.soundingKey, 'A');
const source = '{key: C}\n[C]Home [G/B]again [Am7]always [F]here';
assert.equal(transposeChordPro(source, view.transpose), '{key: C}\n[G]Home [D/F#]again [Em7]always [C]here', 'only rendered chords change; source-key metadata is preserved');
assert.equal(source, '{key: C}\n[C]Home [G/B]again [Am7]always [F]here', 'source chart stays unchanged');
assert.equal(getCapoChartView('C', 'A', null, 2, false).shapesKey, 'A', 'non-guitarist ignores the saved capo');
assert.equal(getCapoChartView('C', 'A', 'G', 2, true).shapesKey, 'G', 'capo uses set key and avoids double-transposing a legacy personal key');
assert.equal(getCapoChartView('C', 'A', 'G', 0, true).shapesKey, 'G', 'Off preserves existing personal key behavior');
assert.equal(getCapoChartView('Bb', 'Bb', null, 3, true).shapesKey, 'G', 'flat keys transpose correctly');
assert.equal(getCapoChartView('C', 'C', null, 12, true).shapesKey, 'C', 'octave capo wraps correctly');
assert.equal(getCapoChartView('C', 'C', null, 13, true).capo, 0, 'invalid capo is not applied');
assert.equal(getCapoChartView('', '', null, 2, true).capo, 0, 'unknown chart key does not apply an ungrounded transpose');
for (const value of [-1, 13, 2.5, '2', NaN, null]) assert.equal(isCapoFret(value), false);
assert.deepEqual(parsePersonalCapoSetting(3), { fret: 3, enabled: true }, 'legacy numeric preferences remain enabled');
assert.deepEqual(parsePersonalCapoSetting(0), { fret: 0, enabled: false });
assert.deepEqual(parsePersonalCapoSetting({ fret: 3, enabled: false }), { fret: 3, enabled: false }, 'Off retains the chosen fret');
for (const value of [{ fret: 99, enabled: false }, { fret: 3, enabled: 'false' }, {}, '3']) assert.equal(parsePersonalCapoSetting(value), null);
assert.equal(getCapoChartView('C', 'A', null, 3, false).shapesKey, 'A', 'switching capo off restores the band key');
assert.equal(getCapoChartView('C', 'A', null, 3, true).shapesKey, 'F#', 'switching it on reuses fret 3');

const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const values = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value); },
} });
try {
  const id = personalCapoStorageId('org', 'guitar', 'song');
  assert.equal(writePersonalCapo(id, { fret: 2, enabled: true, pending: true }), true);
  assert.deepEqual(readPersonalCapo(id), { fret: 2, enabled: true, pending: true }, 'unsynced choice survives closing');
  assert.deepEqual(readPersonalCapo(personalCapoStorageId('org', 'guitar', 'song')), { fret: 2, enabled: true, pending: true }, 'same song reuses settings across events');
  for (const other of [personalCapoStorageId('other-org', 'guitar', 'song'), personalCapoStorageId('org', 'keys', 'song'), personalCapoStorageId('org', 'guitar', 'other-song')]) {
    assert.equal(readPersonalCapo(other), null, 'accounts, organizations and songs stay separate');
  }
  assert.equal(writePersonalCapo(id, { fret: 3, enabled: false, pending: true }), true);
  assert.deepEqual(readPersonalCapo(id), { fret: 3, enabled: false, pending: true }, 'Off and the remembered fret survive offline reopening');
  assert.equal(writePersonalCapo(id, { fret: 0, enabled: false, pending: false }), true);
  assert.deepEqual(readPersonalCapo(id), { fret: 0, enabled: false, pending: false }, 'Off is also saved');
  values.set(id!, '{"fret":2,"pending":false}');
  assert.deepEqual(readPersonalCapo(id), { fret: 2, enabled: true, pending: false }, 'legacy device preferences migrate on read');
  values.set(id!, '{"fret":99,"pending":false}');
  assert.equal(readPersonalCapo(id), null);
  values.set(id!, 'corrupt');
  assert.equal(readPersonalCapo(id), null);
  assert.equal(personalCapoStorageId('org', undefined, 'song'), null);
  assert.notEqual(personalCapoPreferenceKey('org-a', 'song'), personalCapoPreferenceKey('org-b', 'song'));
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Storage blocked'); } });
  assert.equal(readPersonalCapo(id), null);
  assert.equal(writePersonalCapo(id, { fret: 2, enabled: true, pending: true }), false);
} finally {
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  else Reflect.deleteProperty(globalThis, 'localStorage');
}

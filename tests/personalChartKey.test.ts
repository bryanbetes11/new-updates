import { personalChartKeyStorageId, readPersonalChartKey, writePersonalChartKey } from '../src/lib/personalChartKey';
import { getKeyTransposeOffset, transposeChordPro } from '../src/lib/chordPro';

function check(ok: boolean, message: string) { if (!ok) throw new Error(message); }
const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const values = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value); },
  removeItem: (key: string) => { values.delete(key); },
} });
try {
  const id = personalChartKeyStorageId('org', 'guitarist', 'song');
  check(writePersonalChartKey(id, 'G'), 'Personal key saves');
  check(readPersonalChartKey(personalChartKeyStorageId('org', 'guitarist', 'song')) === 'G', 'Reopening the same song in another event restores its key');
  check(transposeChordPro('[A]Hello', getKeyTransposeOffset('A', readPersonalChartKey(id)!)) === '[G]Hello', 'Saved G shapes transpose an A chart for capo 2');
  for (const other of [personalChartKeyStorageId('org', 'other', 'song'), personalChartKeyStorageId('other', 'guitarist', 'song'), personalChartKeyStorageId('org', 'guitarist', 'other')]) {
    check(readPersonalChartKey(other) === null, 'Other accounts, organizations and songs have no override');
  }
  check(writePersonalChartKey(id, null) && readPersonalChartKey(id) === null, 'Reset removes the override');
  values.set(id!, 'invalid');
  check(readPersonalChartKey(id) === null, 'Invalid stored keys are ignored');
  check(personalChartKeyStorageId('org', undefined, 'song') === null, 'Anonymous preferences are not persisted');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Storage blocked'); } });
  check(readPersonalChartKey(id) === null && !writePersonalChartKey(id, 'G'), 'Unavailable storage fails safely');
} finally {
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  else Reflect.deleteProperty(globalThis, 'localStorage');
}

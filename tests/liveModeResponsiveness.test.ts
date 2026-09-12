import { enqueueLatestSave } from '../src/lib/latestSaveQueue';
import { equalRecord } from '../src/lib/equalRecord';
import { createBufferedDraftWriter } from '../src/lib/bufferedDraftWriter';

function check(ok: boolean, message: string) { if (!ok) throw new Error(message); }
let release: () => void = () => {};
const writes: string[] = [];
const first = enqueueLatestSave('one', async () => {
  await new Promise<void>(resolve => { release = resolve; });
  writes.push('C');
});
const middle = enqueueLatestSave('one', async () => { writes.push('D'); });
const latest = enqueueLatestSave('one', async () => { writes.push('E'); });
await enqueueLatestSave('other-user', async () => { writes.push('G'); });
check(writes.join() === 'G', 'Another identity is not blocked by an in-flight save');
check(await middle === false, 'Superseded waiting keys are coalesced');
release();
await Promise.all([first, latest]);
check(writes.join() === 'G,C,E', 'The last selected key is persisted after the older in-flight request');
const failure = enqueueLatestSave('one', async () => { throw new Error('Offline'); }).then(() => false, () => true);
const retry = enqueueLatestSave('one', async () => { writes.push('A'); });
check(await failure, 'Save failures reach the caller for retry feedback');
check(await retry && writes[writes.length - 1] === 'A', 'A failed request cannot strand the next save');

check(equalRecord({ a: 'cue', b: '' }, { b: '', a: 'cue' }), 'Reordered note responses do not cause a render');
check(!equalRecord({ a: 'cue' }, { a: '' }), 'Deleted note content is detected');
check(!equalRecord({ a: 'cue' }, {}), 'Removed notes are detected');

const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const values = new Map<string, string>();
let storageWrites = 0;
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  setItem(key: string, value: string) { values.set(key, value); storageWrites++; },
  removeItem(key: string) { values.delete(key); },
} });
try {
  const writer = createBufferedDraftWriter('song-one');
  writer.schedule({ text: 'first' });
  writer.schedule({ text: 'latest' });
  check(storageWrites === 0, 'Typing does not serialize and write each keystroke');
  writer.flush();
  check(values.get('song-one') === '{"text":"latest"}' && storageWrites === 1, 'Leaving or hiding the editor flushes the latest draft');
  writer.schedule({ text: 'saved' });
  writer.schedule(null);
  await new Promise(resolve => setTimeout(resolve, 180));
  check(!values.has('song-one'), 'A successful save cannot be overwritten by a pending draft timer');
} finally {
  if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
  else Reflect.deleteProperty(globalThis, 'localStorage');
}

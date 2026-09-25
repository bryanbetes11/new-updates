import assert from 'node:assert/strict';
import { createAccessRefreshQueue } from '../src/lib/accessRefresh';

let release: () => void = () => {};
let calls = 0;
const queue = createAccessRefreshQueue(async () => {
  calls++;
  if (calls === 1) await new Promise<void>(resolve => { release = resolve; });
});
const first = queue.request();
await queue.request();
await queue.request();
assert.equal(calls, 1, 'Overlapping signals do not start parallel loads');
release();
await first;
assert.equal(calls, 2, 'Changes during a load cause one fresh follow-up');
queue.dispose();
await queue.request();
assert.equal(calls, 2, 'Disposed account subscription cannot refresh');
let retries = 0;
const retry = createAccessRefreshQueue(async () => { retries++; throw new Error('network'); });
await retry.request();
await retry.request();
assert.equal(retries, 2, 'A failed refresh does not prevent the next signal');
retry.dispose();

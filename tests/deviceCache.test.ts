import assert from 'node:assert/strict';
import { createDeviceSnapshotCache, type DeviceSnapshotRow } from '../src/lib/deviceCacheStore';

let rows: DeviceSnapshotRow[] = [];
let failReset = false;
let time = 100;
let pendingRows: Promise<void> | undefined;
const storage = {
  reset: async (scope: string) => {
    if (failReset) throw new Error('Storage unavailable');
    rows = rows.filter(entry => entry.scope !== scope);
  },
  rows: async () => { await pendingRows; return rows; },
  put: async (row: DeviceSnapshotRow, removeKeys: string[]) => {
    rows = rows.filter(entry => entry.key !== row.key && !removeKeys.includes(entry.key));
    rows.push(row);
  },
};
const cache = createDeviceSnapshotCache(storage, () => time);
await cache.activate('alice:church-a');
const source = { title: 'Saved song' };
const writing = cache.write('alice:church-a', 'songs', source);
source.title = 'Caller changed it';
await writing;
assert.equal((await cache.read<{title: string}>('alice:church-a', 'songs'))?.value.title, 'Saved song');
assert.equal(await cache.read('bob:church-a', 'songs'), null);
const reopened = createDeviceSnapshotCache(storage, () => time);
await reopened.activate('alice:church-a');
assert.ok(await reopened.read('alice:church-a', 'songs'), 'same account persists across process restarts');
time += 365 * 24 * 60 * 60 * 1000;
assert.ok(await cache.read('alice:church-a', 'songs'), 'saved content remains readable after a year');
await cache.activate('bob:church-a');
await cache.write('bob:church-a', 'new-content', ['new']);
await cache.activate('alice:church-a');
assert.ok(await cache.read('alice:church-a', 'songs'), 'writing new content does not expire another account cache');
await cache.activate('bob:church-a');
await cache.clear('bob:church-a');
await cache.activate('alice:church-a');
await cache.write('alice:church-a', 'songs', ['fresh']);
await cache.activate('alice:church-b');
assert.equal(rows.length, 1, 'church switch preserves the other church cache');
assert.equal(await cache.read('alice:church-b', 'songs'), null, 'new church cannot read previous church');
await cache.write('alice:church-a', 'songs', ['late response']);
assert.equal(rows.length, 1, 'late old-scope write is ignored');
await cache.write('alice:church-b', 'songs', ['valid']);
let unblock!: () => void;
pendingRows = new Promise(resolve => { unblock = resolve; });
const lateRead = cache.read('alice:church-b', 'songs');
await Promise.resolve();
const switchAccount = cache.activate('bob:church-b');
unblock();
pendingRows = undefined;
assert.equal(await lateRead, null, 'in-flight read cannot cross an account change');
await switchAccount;
assert.equal(rows.length, 2, 'account switch retains both church caches');
assert.equal(await cache.read('bob:church-b', 'songs'), null, 'new account cannot read another account');
await cache.write('bob:church-b', 'songs', ['bob']);
failReset = true;
await cache.activate('alice:church-a');
assert.deepEqual((await cache.read('alice:church-a', 'songs'))?.value, ['fresh'], 'returning account gets only its retained cache');
await assert.rejects(cache.clear('alice:church-a'), /Could not clear/);
assert.equal(await cache.read('alice:church-a', 'songs'), null, 'failed explicit clear blocks reads until activation');
failReset = false;
await cache.activate(null);
assert.equal(await cache.read('bob:church-b', 'songs'), null, 'signed-out session cannot access any cache');
await cache.activate('alice:church-a');
await cache.write('alice:church-a', 'songs', ['before clear']);
await cache.clear('alice:church-a');
assert.equal(await cache.read('alice:church-a', 'songs'), null);
assert.ok(rows.some(row => row.scope === 'bob:church-b'), 'clearing one account preserves another');
for (let index = 0; index < 517; index += 1) {
  time += 1;
  await cache.write('alice:church-a', `event-${index}`, { title: `Event ${index}` });
}
assert.equal(rows.length, 512, 'entry count stays bounded');
assert.equal(await cache.read('alice:church-a', 'event-0'), null, 'oldest snapshots evicted first');
await cache.write('alice:church-a', 'oversized', 'x'.repeat(8 * 1024 * 1024));
assert.equal(await cache.read('alice:church-a', 'oversized'), null);
await cache.activate(null);
assert.equal(rows.length, 512, 'sign-out preserves persisted data within the global budget');
assert.equal(await cache.read('alice:church-a', 'event-516'), null);
await cache.activate('alice:church-a');
assert.ok(await cache.read('alice:church-a', 'event-516'), 'sign-in restores the matching account cache');

// A larger library must survive above the old 8 MiB total/2 MiB record limits,
// while the global budget still evicts the oldest saved content.
await cache.clear('alice:church-a');
for (let index = 0; index < 6; index += 1) {
  time += 1;
  await cache.write('alice:church-a', `large-library-${index}`, 'x'.repeat(6 * 1024 * 1024));
}
assert.ok(rows.reduce((total, row) => total + row.bytes, 0) <= 32 * 1024 * 1024);
assert.equal(await cache.read('alice:church-a', 'large-library-0'), null);
assert.ok(await cache.read('alice:church-a', 'large-library-1'), 'retains more than the old total budget');
assert.ok(await cache.read('alice:church-a', 'large-library-5'), 'latest large snapshot survives eviction');

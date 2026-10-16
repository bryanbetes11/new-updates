import assert from 'node:assert/strict';
import { createDesktopAlertDelivery, type DesktopAlertRow } from '../src/lib/desktopNotifications';

let now = Date.parse('2026-10-10T00:00:00Z');
let active = true;
let enabled = true;
let granted = true;
let count = 0;
let permission: () => Promise<boolean> = async () => granted;
let fail = false;
const deliver = createDesktopAlertDelivery({ userId: 'u1', orgId: 'o1' }, {
  active: () => active, enabled: () => enabled, permission: () => permission(), now: () => now,
  send: async () => { if (fail) throw Error('Native error'); count++; },
});
const row: DesktopAlertRow = { id: 'n1', user_id: 'u1', org_id: 'o1', created_at: new Date(now).toISOString(), is_read: false, delivery_channels: { push: true } };
await Promise.all([deliver(row), deliver(row)]);
await deliver(row);
assert.equal(count, 1, 'realtime and polling deliver only once');
for (const change of [
  { user_id: 'u2' }, { org_id: 'o2' }, { is_read: true }, { dismissed_at: new Date(now).toISOString() },
  { delivery_channels: { push: false } }, { created_at: 'invalid' },
  { created_at: new Date(now - 1).toISOString() }, { scheduled_for: new Date(now + 60_000).toISOString() },
]) await deliver({ ...row, id: 'rejected', ...change });
assert.equal(count, 1, 'reject wrong accounts, dismissed/read/old alerts and future schedules');
enabled = false; await deliver({ ...row, id: 'disabled' });
enabled = true; granted = false; await deliver({ ...row, id: 'denied' });
assert.equal(count, 1);
granted = true;
let resolvePermission: (value: boolean) => void = () => {};
permission = () => new Promise(resolve => { resolvePermission = resolve; });
const pending = deliver({ ...row, id: 'switch-account' });
active = false; resolvePermission(true); await pending;
assert.equal(count, 1, 'account change during permission check cancels delivery');
active = true; permission = async () => true;
fail = true;
await assert.rejects(deliver({ ...row, id: 'retry' }));
fail = false; await deliver({ ...row, id: 'retry' });
assert.equal(count, 2, 'failed native delivery can be retried');
now += 180_000; await deliver({ ...row, id: 'stale' });
assert.equal(count, 2, 'do not flood the user with stale catch-up alerts');

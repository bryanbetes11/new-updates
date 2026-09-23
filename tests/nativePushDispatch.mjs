import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
// Execute the actual request handler with fake transport/database, never real recipients.
const source = (await readFile(new URL('../supabase/functions/send-push/index.ts', import.meta.url), 'utf8'))
  .replace(/^import .*;\r?\n/gm, '');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const user = '00000000-0000-4000-8000-000000000011';
const org = '00000000-0000-4000-8000-000000000001';
const notification = '00000000-0000-4000-8000-000000000031';
async function run(overrides = {}) {
  const options = { native: true, web: true, androidEnabled: 'true', enabled: true, quiet: false, stale: false, nativeFail: false, ...overrides };
  let handler;
  const calls = { web: 0, native: 0, updates: [], queries: [] };
  const rows = {
    profiles: { org_id: org }, notifications: { id: notification, org_id: options.wrongOrg ? 'other' : org, type: 'assignment', priority: 'normal', required: false },
    organizations: { name: 'Fixture Church' }, notification_system_settings: { push_delivery_enabled: true },
    notification_rules: { enabled: true, push_enabled: true, required: false, priority: 'normal' },
    notification_preferences: { push_enabled: options.enabled, quiet_hours_enabled: options.quiet, quiet_start: '00:00', quiet_end: '00:00', timezone: 'UTC', muted_types: [] },
    push_subscriptions: options.web ? [{ id: 'web-id', endpoint: 'fake', p256dh: 'fake', auth_key: 'fake' }] : [],
    native_push_devices: options.native ? [{ installation_id: 'device-id', token: 'fixture-token' }] : [],
  };
  const client = {
    rpc: async () => ({ data: { webhook_secret: 'fixture-secret', vapid_private_key: 'fixture-vapid' }, error: null }),
    from(table) {
      const query = { table, filters: [], mutation: null };
      calls.queries.push(query);
      const builder = {
        select() { return this; }, eq(key, value) { query.filters.push([key, value]); return this; },
        not() { return this; }, maybeSingle() { return this; }, delete() { query.mutation = 'delete'; return this; },
        update(value) { query.mutation = value; calls.updates.push({ table, value }); return this; },
        then(resolve) { return Promise.resolve({ data: rows[table], error: null }).then(resolve); },
      };
      return builder;
    },
  };
  vm.runInNewContext(code, {
    Deno: { env: { get: key => ({ ANDROID_PUSH_ENABLED: options.androidEnabled, ANDROID_PUSH_TEST_USER_IDS: 'different-legacy-test-user' })[key] }, serve: callback => { handler = callback; } },
    createClient: () => client,
    createFcmSender: () => async message => { calls.native++; assert.equal(message.userId, user); return { ok: !options.nativeFail && !options.stale, stale: options.stale }; },
    webpush: { setVapidDetails() {}, sendNotification: async () => { calls.web++; } },
    Request, Response, Date, Intl, console,
  });
  const response = await handler(new Request('https://fixture.invalid/send-push', { method: 'POST', headers: { 'x-internal-secret': options.badSecret ? 'wrong' : 'fixture-secret' },
    body: JSON.stringify({ user_id: user, notification_id: notification, title: 'Test', body: 'Fixture only', data: { url: '/notifications' } }) }));
  return { calls, status: response.status, body: await response.json() };
}
let result = await run();
assert.equal(result.body.sent, 2);
assert.equal(result.body.total, 2);
assert.ok(result.calls.queries.some(q => q.table === 'native_push_devices' && q.filters.some(([key, value]) => key === 'org_id' && value === org)), 'native recipients are church scoped');
assert.equal(result.calls.native, 1, 'regular recipients need no test allowlist membership');
assert.ok(result.calls.queries.some(q => q.table === 'native_push_devices' && q.filters.some(([key, value]) => key === 'user_id' && value === user) && q.filters.some(([key, value]) => key === 'enabled' && value === true)), 'only recipient-owned opted-in installations receive');
for (const androidEnabled of ['false', undefined]) {
  result = await run({ androidEnabled });
  assert.equal(result.calls.native, 0); assert.equal(result.calls.web, 1, 'Android kill switch preserves web delivery');
}
result = await run({ enabled: false });
assert.equal(result.calls.native + result.calls.web, 0, 'user preferences apply to both transports');
result = await run({ quiet: true });
assert.equal(result.calls.native + result.calls.web, 0, 'quiet hours apply to both transports');
assert.ok(result.calls.updates.some(update => update.value.push_status === 'deferred'));
result = await run({ web: false });
assert.equal(result.body.sent, 1, 'native-only device can receive');
result = await run({ nativeFail: true });
assert.ok(result.calls.updates.some(update => update.value.push_status === 'partial'), 'native failure does not turn web success into failure');
result = await run({ stale: true });
assert.ok(result.calls.queries.some(q => q.table === 'native_push_devices' && q.mutation?.enabled === false && q.filters.some(([key, value]) => key === 'token' && value === 'fixture-token')), 'cleanup is conditional on exact stale token');
assert.equal((await run({ badSecret: true })).status, 401);
assert.equal((await run({ wrongOrg: true })).status, 403);
console.log('PASS native push dispatch: custom auth, org/user scope, all opted-in recipients, kill switch, preferences, quiet hours, native-only, partial delivery, stale-token refresh protection');

import { createNativePushController, nativePushDestination } from '../src/lib/nativePushController';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
let owner: string | null = null;
let current: string | null = 'alice';
let allowed = true;
let failRevoke = false;
let claims = 0;
let revokes = 0;
let waitToken: (() => Promise<string>) | null = null;
const controller = createNativePushController({
  owner: () => owner, saveOwner: value => { owner = value; }, currentUser: async () => current,
  permission: async () => allowed, token: () => waitToken ? waitToken() : Promise.resolve('test-token'),
  claim: async () => { claims++; }, revoke: async () => { if (failRevoke) throw new Error('offline'); revokes++; },
  unregister: async () => undefined, clearDelivered: async () => undefined,
});
assert(await controller.enable('alice'), 'can register the signed-in user');
assert(owner === 'alice' && claims === 1, 'ownership persisted and registration claimed');
current = 'bob';
await controller.reconcile('bob');
assert(owner === null && revokes === 1, 'switching accounts removes the old recipient without opting in the new one');
allowed = false;
let denied = false;
try { await controller.enable('bob'); } catch { denied = true; }
assert(denied && owner === null, 'denied permission never claims a device');
allowed = true;
await controller.enable('bob');
failRevoke = true;
let blocked = false;
try { await controller.disable(); } catch { blocked = true; }
assert(blocked && owner === 'bob', 'failed cleanup remains retryable and blocks explicit account transition');
failRevoke = false;
await controller.disable();
let release!: (value: string) => void;
waitToken = () => new Promise(resolve => { release = resolve; });
const beforeRace = claims;
const enabling = controller.enable('bob');
for (let i = 0; i < 10 && !release; i++) await Promise.resolve();
const disabling = controller.disable();
release('late-token');
assert(!await enabling, 'late token registration is cancelled');
await disabling;
assert(claims === beforeRace && owner === null, 'late token cannot restore a disabled registration');
assert(nativePushDestination({ user_id: 'alice', url: '/events?id=1' }, 'alice') === '/events?id=1', 'local destinations work');
assert(nativePushDestination({ user_id: 'alice', url: '/events' }, 'bob') === null, 'other account notification is ignored');
for (const url of ['https://evil.test', '//evil.test', '/\\evil.test', '/\nevil.test', 'javascript:alert(1)']) {
  assert(nativePushDestination({ user_id: 'alice', url }, 'alice') === '/notifications', 'untrusted URL is rejected');
}

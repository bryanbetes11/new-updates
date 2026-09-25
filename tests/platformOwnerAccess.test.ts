import assert from 'node:assert/strict';
import { hasPlatformOwnerAccess, loadPlatformOwnerAccess } from '../src/lib/platformOwnerAccess';

const owner = await loadPlatformOwnerAccess('owner', async () => ({ data: true, error: null }));
assert.equal(hasPlatformOwnerAccess(owner, 'owner', false), true);
assert.equal(hasPlatformOwnerAccess(owner, 'ordinary', false), false, 'Account switching cannot reuse the previous owner grant');
assert.equal(hasPlatformOwnerAccess(owner, undefined, false), false);
assert.equal(hasPlatformOwnerAccess(owner, 'owner', true), false);
assert.equal(hasPlatformOwnerAccess(null, 'owner', false), false);
for (const data of [false, null, 'true', 1]) {
  const access = await loadPlatformOwnerAccess('ordinary', async () => ({ data, error: null }));
  assert.equal(hasPlatformOwnerAccess(access, 'ordinary', false), false);
}
const denied = await loadPlatformOwnerAccess('owner', async () => ({ data: true, error: { message: 'denied' } }));
assert.equal(denied.allowed, false);
const unavailable = await loadPlatformOwnerAccess('owner', async () => { throw new Error('offline'); });
assert.equal(unavailable.allowed, false);

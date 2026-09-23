import assert from 'node:assert/strict';
import { classifyAppAccess, appAccessKinds } from '../src/lib/memberAppAccess';

assert.deepEqual(classifyAppAccess('android', true, 'other'), { kind: 'android_app', platform: 'android' }, 'native wins over display mode');
assert.deepEqual(classifyAppAccess('ios', true, 'ios'), { kind: 'ios_app', platform: 'ios' });
assert.deepEqual(classifyAppAccess('web', true, 'ios'), { kind: 'pwa', platform: 'ios' });
assert.deepEqual(classifyAppAccess('web', false, 'android'), { kind: 'browser', platform: 'android' });
assert.deepEqual(classifyAppAccess('web', false, 'other'), { kind: 'browser', platform: 'other' });
assert.deepEqual(appAccessKinds([]), []);
assert.deepEqual(appAccessKinds([
  {user_id: 'a', app_kind: 'browser', platform: 'other', last_seen_at: ''},
  {user_id: 'a', app_kind: 'pwa', platform: 'android', last_seen_at: ''},
  {user_id: 'a', app_kind: 'browser', platform: 'android', last_seen_at: ''},
  {user_id: 'a', app_kind: 'android_app', platform: 'android', last_seen_at: ''},
]), ['android_app','pwa','browser'], 'multiple access kinds preserved, duplicate kinds collapsed');

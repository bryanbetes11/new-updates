import assert from 'node:assert/strict';
import { ANDROID_TEST_RELEASE, shouldOfferAndroidApp } from '../src/lib/androidDownload';

const eligible = { android: true, standalone: true, native: false, signedIn: true, dashboard: true };
assert.equal(shouldOfferAndroidApp(eligible), true);
for (const changed of [{ android: false }, { standalone: false }, { native: true }, { signedIn: false }, { dashboard: false }]) {
  assert.equal(shouldOfferAndroidApp({ ...eligible, ...changed }), false, 'only signed-in installed Android PWA users see the offer at Home');
}
assert.ok(ANDROID_TEST_RELEASE.url.startsWith('https://github.com/bryanbetes11/new-updates/releases/download/'));
assert.ok(ANDROID_TEST_RELEASE.url.endsWith('/' + ANDROID_TEST_RELEASE.filename));
assert.equal(ANDROID_TEST_RELEASE.filename, 'ServeSync-1.4.7.apk');
assert.equal(ANDROID_TEST_RELEASE.build, 26);
assert.ok(ANDROID_TEST_RELEASE.url.includes('/android-v1.4.7-build26/'));

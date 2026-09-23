import assert from 'node:assert/strict';
import { ANDROID_TEST_RELEASE, APK_OFFER_INTERVAL, isAndroidOfferDue, shouldOfferAndroidApp } from '../src/lib/androidDownload';

const eligible = { android: true, standalone: true, native: false, signedIn: true, dashboard: true, dismissed: false };
assert.equal(shouldOfferAndroidApp(eligible), true);
for (const changed of [{ android: false }, { standalone: false }, { native: true }, { signedIn: false }, { dashboard: false }, { dismissed: true }]) {
  assert.equal(shouldOfferAndroidApp({ ...eligible, ...changed }), false, 'only signed-in installed Android PWA users see the offer at Home');
}
assert.ok(ANDROID_TEST_RELEASE.url.startsWith('https://github.com/bryanbetes11/new-updates/releases/download/'));
assert.ok(ANDROID_TEST_RELEASE.url.endsWith('/' + ANDROID_TEST_RELEASE.filename));
const now = 2 * APK_OFFER_INTERVAL;
assert.equal(isAndroidOfferDue(null, now, false), true);
assert.equal(isAndroidOfferDue(now - APK_OFFER_INTERVAL + 1, now, false), false);
assert.equal(isAndroidOfferDue(now - APK_OFFER_INTERVAL, now, false), true);
assert.equal(isAndroidOfferDue(null, now, true), false, 'Android use suppresses install reminder');
assert.equal(isAndroidOfferDue(now + 1000, now, false), false, 'clock moving backward does not trigger repeat');

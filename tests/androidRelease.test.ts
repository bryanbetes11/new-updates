import assert from 'node:assert/strict';
import { newestAndroidRelease, isTrustedAndroidDownload, createAndroidUpdateChecker } from '../src/lib/androidRelease';

function release(build: number, version = '1.3.1') {
  const tag = `android-test-v${version}-build${build}`;
  const name = `ServeSync-${version}-android-test-build${build}.apk`;
  return { tag_name: tag, draft: false, prerelease: true, published_at: '2026-09-24T00:00:00Z', assets: [{ name, state: 'uploaded', size: 123456, browser_download_url: `https://github.com/bryanbetes11/new-updates/releases/download/${tag}/${name}` }] };
}

assert.equal(newestAndroidRelease([release(6), release(9), release(8)], 7)?.build, 9, 'choose highest Android build, not list order or patch version');
assert.equal(newestAndroidRelease([release(7), release(6)], 7), null, 'never offer current or older build');
assert.equal(newestAndroidRelease([release(8)], 7)?.version, '1.3.1', 'same marketing version can have a newer build');
const cleanTag = 'android-v1.4.0-build14';
const cleanName = 'ServeSync-1.4.0.apk';
const cleanUrl = `https://github.com/bryanbetes11/new-updates/releases/download/${cleanTag}/${cleanName}`;
const digest = 'a'.repeat(64);
const compatibilityName = 'ServeSync-1.4.0-android-release-build14.apk';
const compatibilityUrl = `https://github.com/bryanbetes11/new-updates/releases/download/${cleanTag}/${compatibilityName}`;
const cleanRelease = { tag_name: cleanTag, draft: false, published_at: '2026-09-24T00:00:00Z', assets: [
  { name: compatibilityName, state: 'uploaded', size: 123456, digest: `sha256:${digest}`, browser_download_url: compatibilityUrl },
  { name: cleanName, state: 'uploaded', size: 123456, digest: `sha256:${digest}`, browser_download_url: cleanUrl },
] };
assert.equal(newestAndroidRelease([cleanRelease], 13)?.url, cleanUrl, 'prefer the clean filename even when the compatibility asset comes first');
assert.equal(newestAndroidRelease([cleanRelease], 13)?.sha256, digest, 'carry the release checksum into the native download');
const nextTag = 'android-v1.4.1-build20';
const nextName = 'ServeSync-1.4.1.apk';
const nextUrl = `https://github.com/bryanbetes11/new-updates/releases/download/${nextTag}/${nextName}`;
const nextRelease = { tag_name: nextTag, draft: false, published_at: '2026-09-24T00:00:00Z', assets: [
  { name: nextName, state: 'uploaded', size: 123456, digest: `sha256:${digest}`, browser_download_url: nextUrl },
] };
assert.equal(newestAndroidRelease([cleanRelease, nextRelease], 19)?.url, nextUrl, 'installed 1.4.0 detects 1.4.1');
assert.equal(newestAndroidRelease([cleanRelease, nextRelease], 20), null, 'installed 1.4.1 is current');
const currentTag = 'android-v1.4.2-build21';
const currentName = 'ServeSync-1.4.2.apk';
const currentUrl = `https://github.com/bryanbetes11/new-updates/releases/download/${currentTag}/${currentName}`;
const currentRelease = { tag_name: currentTag, draft: false, published_at: '2026-09-24T00:00:00Z', assets: [
  { name: currentName, state: 'uploaded', size: 123456, digest: `sha256:${digest}`, browser_download_url: currentUrl },
] };
assert.equal(newestAndroidRelease([nextRelease, currentRelease], 20)?.url, currentUrl, 'installed 1.4.1 detects 1.4.2');
assert.equal(newestAndroidRelease([nextRelease, currentRelease], 21), null, 'installed 1.4.2 is current');
const newestTag = 'android-v1.4.3-build22';
const newestName = 'ServeSync-1.4.3.apk';
const newestUrl = `https://github.com/bryanbetes11/new-updates/releases/download/${newestTag}/${newestName}`;
const newestRelease = { tag_name: newestTag, draft: false, published_at: '2026-09-24T00:00:00Z', assets: [
  { name: newestName, state: 'uploaded', size: 123456, digest: `sha256:${digest}`, browser_download_url: newestUrl },
] };
assert.equal(newestAndroidRelease([currentRelease, newestRelease], 21)?.url, newestUrl, 'installed 1.4.2 detects 1.4.3');
assert.equal(newestAndroidRelease([currentRelease, newestRelease], 22), null, 'installed 1.4.3 is current');
const patchTag = 'android-v1.4.5-build24';
const patchName = 'ServeSync-1.4.5.apk';
const patchUrl = `https://github.com/bryanbetes11/new-updates/releases/download/${patchTag}/${patchName}`;
const patchRelease = { tag_name: patchTag, draft: false, published_at: '2026-09-24T00:00:00Z', assets: [
  { name: patchName, state: 'uploaded', size: 123456, digest: `sha256:${digest}`, browser_download_url: patchUrl },
] };
assert.equal(newestAndroidRelease([newestRelease, patchRelease], 23)?.url, patchUrl, 'installed 1.4.4 detects 1.4.5');
assert.equal(newestAndroidRelease([newestRelease, patchRelease], 24), null, 'installed 1.4.5 is current');
assert.equal(isTrustedAndroidDownload(cleanUrl), true);
assert.equal(isTrustedAndroidDownload(cleanUrl.replace('1.4.0.apk', '1.4.1.apk')), false, 'asset version must match the release tag');
assert.equal(newestAndroidRelease([{ ...release(9), draft: true }], 7), null);
assert.equal(newestAndroidRelease([{ ...release(9), published_at: null }], 7), null);
assert.equal(newestAndroidRelease([{ ...release(9), assets: [] }], 7), null);
assert.equal(newestAndroidRelease([{ ...release(9), tag_name: 'web-v9.0.0' }], 7), null);
assert.equal(newestAndroidRelease([{ ...release(9), assets: [{ ...release(9).assets[0], name: release(8).assets[0].name }] }], 7), null);
for (const url of ['https://evil.example/app.apk', 'https://github.com.evil.example/a.apk', release(9).assets[0].browser_download_url + '?redirect=evil', 'http://github.com/bryanbetes11/new-updates/releases/download/x/y.apk']) {
  assert.equal(isTrustedAndroidDownload(url), false);
  assert.equal(newestAndroidRelease([{ ...release(9), assets: [{ ...release(9).assets[0], browser_download_url: url }] }], 7), null);
}
assert.throws(() => newestAndroidRelease({ message: 'rate limit' }, 7));
assert.throws(() => newestAndroidRelease([], NaN));

let now = 1000;
let calls = 0;
let fail = false;
let data: unknown = [release(8)];
const checker = createAndroidUpdateChecker({
  installed: async () => ({ version: '1.3.1', build: '7' }),
  releases: async () => { calls++; if (fail) throw new Error('Offline'); return data; },
  now: () => now,
});
const first = checker.check();
assert.equal(checker.check(true), first, 'manual and automatic requests share an in-flight check');
assert.equal((await first).status, 'available');
await checker.check();
assert.equal(calls, 1, 'resume checks are throttled');
await checker.check(true);
assert.equal(calls, 2, 'manual check bypasses success throttle');
fail = true;
assert.equal((await checker.check(true)).status, 'error', 'offline is not up to date');
await checker.check();
assert.equal(calls, 3, 'failed auto checks back off');
now += 60000;
fail = false;
data = [release(6)];
assert.equal((await checker.check()).status, 'up-to-date');
assert.equal(checker.getSnapshot().release, null, 'withdrawn release is cleared after successful check');
const invalid = createAndroidUpdateChecker({ installed: async () => ({ version: '1.3.1', build: '' }), releases: async () => [], now: () => 0 });
assert.equal((await invalid.check()).status, 'error');

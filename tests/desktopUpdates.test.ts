import assert from 'node:assert/strict';
import { createDesktopUpdates, DESKTOP_CHECK_INTERVAL, type DesktopRelease, type DownloadProgress } from '../src/lib/desktopUpdates';

let now = 100;
let calls = 0;
let downloads = 0;
let restarts = 0;
let failCheck = false;
let failDownload = false;
let enabled = true;
let onProgress: ((event: DownloadProgress) => void) | undefined;
let finish: (() => void) | undefined;
const release: DesktopRelease = {
  version: '1.4.20', body: 'New Windows release', close: async () => {},
  downloadAndInstall: async cb => {
    downloads++;
    if (failDownload) throw new Error('Signature or network error');
    onProgress = cb;
    await new Promise<void>(resolve => { finish = resolve; });
  },
};
let result: DesktopRelease | null = null;
const controller = createDesktopUpdates({
  enabled: () => enabled, version: async () => '1.4.19', now: () => now,
  check: async () => { calls++; if (failCheck) throw new Error('offline'); return result; },
  restart: async () => { restarts++; },
});
enabled = false;
await controller.check(true);
assert.equal(calls, 0, 'web and Android never use native updater');
enabled = true;
await Promise.all([controller.check(), controller.check()]);
assert.equal(calls, 1, 'overlapping checks share one request');
assert.equal(controller.getSnapshot().status, 'current');
await controller.check();
assert.equal(calls, 1, 'background checks are throttled');
now += DESKTOP_CHECK_INTERVAL;
result = release;
await controller.check();
assert.equal(controller.getSnapshot().status, 'available');
assert.equal(downloads, 0, 'automatic check never downloads or installs');
assert.equal(restarts, 0);
const install = controller.install();
await controller.install();
await controller.check(true);
assert.equal(downloads, 1, 'double-click cannot start another installer');
assert.equal(calls, 2, 'checks cannot replace an active download');
onProgress!({ event: 'Started', data: { contentLength: 100 } });
onProgress!({ event: 'Progress', data: { chunkLength: 50 } });
assert.equal(controller.getSnapshot().progress, 50);
onProgress!({ event: 'Finished' });
assert.equal(restarts, 0, 'download finished is not installation success');
finish!(); await install;
assert.equal(restarts, 1);

const retry = createDesktopUpdates({ enabled: () => true, now: () => now, version: async () => '1.4.19', check: async () => { if (failCheck) throw new Error('offline'); return release; }, restart: async () => { restarts++; } });
failCheck = true; await retry.check(true);
assert.equal(retry.getSnapshot().status, 'error', 'missing feed is not up-to-date');
failCheck = false; await retry.check(true);
failDownload = true; await retry.install();
assert.equal(retry.getSnapshot().status, 'error');
assert.equal(restarts, 1, 'failed verification never restarts the running app');
assert.equal(retry.getSnapshot().version, release.version, 'failed download remains retryable');

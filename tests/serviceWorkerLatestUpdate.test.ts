import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'src/lib/serviceWorkerUpdate.ts'), 'utf8');

assert.match(
  source,
  /serviceWorkerScriptMatchesCacheVersion\(worker\.scriptURL, update\.cacheVersion\)/,
  'a waiting worker must match the latest manifest cache version before it can be offered',
);

assert.match(
  source,
  /const latestWorkerReady = await waitForMatchingWaitingWorker\(registration, update\)/,
  'the update check must wait for the exact latest worker to finish installing',
);

assert.match(
  source,
  /const latestCheck = await checkForAppUpdate\(\)/,
  'Update Now must refresh the manifest and worker state before activation',
);

assert.match(
  source,
  /if \(latestCheck\.status === 'unavailable'\)[\s\S]*No older update was applied/,
  'a failed latest-version check must never activate a previously queued intermediate update',
);

assert.doesNotMatch(
  source,
  /latestCheck\.status === 'available' \? latestCheck\.manifest : previousUpdate/,
  'Update Now must not fall back to an older pending manifest',
);

assert.match(
  source,
  /if \(!workerMatchesUpdate\(navigator\.serviceWorker\.controller, pendingUpdate\)\) return/,
  'a controller change must not reload the app for an intermediate worker',
);

assert.doesNotMatch(
  source,
  /setTimeout\(\(\) => window\.location\.reload\(\), 4000\)/,
  'the updater must not blindly reload before the latest worker controls the page',
);

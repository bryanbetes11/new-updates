import { compareAppVersions, isAppVersionBelow } from '../src/lib/appUpdate';
import {
  getServiceWorkerCacheVersion,
  serviceWorkerScriptMatchesCacheVersion,
} from '../src/lib/serviceWorkerUpdate';

function expectEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

expectEqual(compareAppVersions('1.1.0', '1.1.0'), 0, 'matches equal versions');
expectEqual(compareAppVersions('v1.2.0', '1.1.9'), 1, 'recognizes a newer minor version');
expectEqual(compareAppVersions('1.1.1', '1.1.2'), -1, 'recognizes an older patch version');
expectEqual(compareAppVersions('2.0', '1.99.99'), 1, 'normalizes missing patch numbers');
expectEqual(isAppVersionBelow('1.1.0', '1.2.0'), true, 'requires an update below the supported minimum');
expectEqual(isAppVersionBelow('1.2.0', '1.2.0'), false, 'accepts the minimum supported version');
expectEqual(
  getServiceWorkerCacheVersion('/sw.js?v=1.4.0-latest-build&appVersion=1.4.0', 'https://servesync.example'),
  '1.4.0-latest-build',
  'identifies the exact worker cache build instead of only its public app version',
);
expectEqual(
  serviceWorkerScriptMatchesCacheVersion(
    '/sw.js?v=1.4.0-intermediate&appVersion=1.4.0',
    '1.4.0-latest-build',
    'https://servesync.example',
  ),
  false,
  'rejects an intermediate waiting worker even when its public app version matches',
);
expectEqual(
  serviceWorkerScriptMatchesCacheVersion(
    '/sw.js?v=1.4.0-latest-build&appVersion=1.4.0',
    '1.4.0-latest-build',
    'https://servesync.example',
  ),
  true,
  'accepts only the worker for the latest cache build',
);

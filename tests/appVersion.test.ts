import { compareAppVersions, isAppVersionBelow } from '../src/lib/appUpdate';

function expectEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

expectEqual(compareAppVersions('1.1.0', '1.1.0'), 0, 'matches equal versions');
expectEqual(compareAppVersions('v1.2.0', '1.1.9'), 1, 'recognizes a newer minor version');
expectEqual(compareAppVersions('1.1.1', '1.1.2'), -1, 'recognizes an older patch version');
expectEqual(compareAppVersions('2.0', '1.99.99'), 1, 'normalizes missing patch numbers');
expectEqual(isAppVersionBelow('1.1.0', '1.2.0'), true, 'requires an update below the supported minimum');
expectEqual(isAppVersionBelow('1.2.0', '1.2.0'), false, 'accepts the minimum supported version');

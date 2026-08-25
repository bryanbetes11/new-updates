import { isValidChurchSlug, normalizeChurchSlug, slugifyChurchName } from '../src/lib/churchOnboarding';

function expectEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

expectEqual(slugifyChurchName('  Grace Community Church  '), 'grace-community-church', 'creates a stable church slug');
expectEqual(slugifyChurchName('Iglesia ni Cristo — East'), 'iglesia-ni-cristo-east', 'removes unsupported punctuation');
expectEqual(normalizeChurchSlug('Grace   North!!!'), 'grace-north', 'normalizes manual slug edits');
expectEqual(isValidChurchSlug('grace-north'), true, 'accepts a valid church slug');
expectEqual(isValidChurchSlug('ab'), false, 'rejects a slug shorter than three characters');
expectEqual(isValidChurchSlug('-grace'), false, 'rejects a leading hyphen');
expectEqual(isValidChurchSlug('grace-'), false, 'rejects a trailing hyphen');
expectEqual(isValidChurchSlug('Grace Church'), false, 'rejects an unnormalized slug');

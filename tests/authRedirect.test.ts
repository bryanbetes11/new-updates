import { isPasswordRecoveryUrl, recoveryRedirectPath } from '../src/lib/authRedirect';

function expectEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

expectEqual(
  isPasswordRecoveryUrl('?type=recovery&code=abc', ''),
  true,
  'recognizes query-string recovery links',
);
expectEqual(
  isPasswordRecoveryUrl('', '#access_token=abc&refresh_token=def&type=recovery'),
  true,
  'recognizes hash recovery links',
);
expectEqual(
  isPasswordRecoveryUrl('?type=recovery', ''),
  false,
  'rejects recovery links without a token',
);
expectEqual(
  isPasswordRecoveryUrl('?code=abc&type=invite', ''),
  false,
  'does not confuse invitation links with password recovery',
);
expectEqual(
  recoveryRedirectPath('?type=recovery&code=abc', '#next'),
  '/reset-password?type=recovery&code=abc#next',
  'preserves recovery parameters through the redirect',
);

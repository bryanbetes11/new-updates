import { getLastAppRoute, isRememberableAppRoute, rememberLastAppRoute } from '../src/lib/appStartup';

function expectEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

expectEqual(isRememberableAppRoute('/events/event-1?mode=service'), true, 'accepts useful authenticated routes');
expectEqual(isRememberableAppRoute('/login'), false, 'does not remember Login');
expectEqual(isRememberableAppRoute('/register?email=test@example.com'), false, 'does not remember account setup');
expectEqual(isRememberableAppRoute('//example.com'), false, 'rejects protocol-relative redirects');
expectEqual(isRememberableAppRoute('/unknown-page'), false, 'does not remember unknown routes');

const storage = createStorage();
expectEqual(getLastAppRoute(storage, 'user-1'), '/dashboard', 'defaults to Home without saved history');
rememberLastAppRoute(storage, 'user-1', '/messages/team-chat');
expectEqual(getLastAppRoute(storage, 'user-1'), '/messages/team-chat', 'restores the saved workspace for the same user');
expectEqual(getLastAppRoute(storage, 'user-2'), '/dashboard', 'keeps saved routes isolated by account');
rememberLastAppRoute(storage, 'user-1', '/login');
expectEqual(getLastAppRoute(storage, 'user-1'), '/messages/team-chat', 'ignores attempts to replace history with a public route');

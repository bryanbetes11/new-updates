import {
  readSavedAccounts,
  removeSavedAccount,
  upsertSavedAccount,
  type SavedAccount,
} from '../src/lib/savedAccounts';

function expectEqual(actual: unknown, expected: unknown, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { localStorage: storage },
});

const first: SavedAccount = {
  userId: 'user-1',
  email: 'first@example.com',
  displayName: 'First User',
  avatarUrl: 'first.jpg',
  lastUsedAt: '2026-07-12T10:00:00.000Z',
  session: { accessToken: 'access-1', refreshToken: 'refresh-1' },
};
const second: SavedAccount = {
  userId: 'user-2',
  email: 'second@example.com',
  displayName: 'Second User',
  avatarUrl: null,
  lastUsedAt: '2026-07-13T10:00:00.000Z',
  session: { accessToken: 'access-2', refreshToken: 'refresh-2' },
};

upsertSavedAccount(first);
upsertSavedAccount(second);
expectEqual(
  readSavedAccounts().map(account => account.userId),
  ['user-2', 'user-1'],
  'sorts account shortcuts by most recent use',
);

upsertSavedAccount({
  ...first,
  displayName: '',
  avatarUrl: null,
  lastUsedAt: '2026-07-14T10:00:00.000Z',
  session: { accessToken: 'access-new', refreshToken: 'refresh-new' },
});
const updated = readSavedAccounts()[0];
expectEqual(updated.displayName, 'First User', 'keeps the previous display name when a refresh omits it');
expectEqual(updated.avatarUrl, 'first.jpg', 'keeps the previous avatar when a refresh omits it');
expectEqual(updated.session.accessToken, 'access-new', 'refreshes the saved session token');

removeSavedAccount('user-1');
expectEqual(
  readSavedAccounts().map(account => account.userId),
  ['user-2'],
  'removes only the selected saved account',
);

storage.setItem('servesync-saved-accounts', '{invalid json');
expectEqual(readSavedAccounts(), [], 'ignores corrupted saved-account storage');

delete (globalThis as { window?: unknown }).window;

import { Capacitor } from '@capacitor/core';
import type { User } from '@supabase/supabase-js';
import { isDefinitelyInvalidSession, isOfflineNetworkError, readOfflineAccount, revokeOfflineAccount, saveOfflineAccount } from '../src/lib/offlineAccount';
import type { SavedAccount } from '../src/lib/savedAccounts';
import type { Organization, Profile } from '../src/types';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
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

const localStorage = new MemoryStorage();
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage } });
const originalPlatform = Capacitor.getPlatform;
Capacitor.getPlatform = () => 'android';

try {
  const user = { id: 'account-1', email: 'first@example.com' } as User;
  const profile = { id: 'account-1', org_id: 'church-1' } as Profile;
  const organization = { id: 'church-1', name: 'First Church' } as Organization;
  const saved: SavedAccount[] = [{
    userId: 'account-1', email: user.email || '', displayName: 'First User', avatarUrl: null,
    lastUsedAt: new Date().toISOString(), session: { accessToken: 'access', refreshToken: 'refresh' },
  }];

  saveOfflineAccount(user, profile, organization);
  assert(readOfflineAccount(saved)?.profile.org_id === 'church-1', 'last authenticated church can reopen offline');
  assert(readOfflineAccount(saved, 'web') === null, 'browser cannot open Android identity');
  assert(readOfflineAccount([]) === null, 'a snapshot without its saved account cannot grant access');
  assert(readOfflineAccount([{ ...saved[0], userId: 'account-2' }]) === null, 'a different saved account cannot open this cache');

  localStorage.setItem('servesync-offline-active-v1', 'account-2');
  assert(readOfflineAccount(saved) === null, 'changing the active marker cannot open another identity');
  localStorage.setItem('servesync-offline-active-v1', 'account-1');
  localStorage.setItem('servesync-offline-account-v1', JSON.stringify({ user, profile, organization: { id: 'church-2' }, savedAt: Date.now() }));
  assert(readOfflineAccount(saved) === null, 'a church mismatch cannot open cached data');

  saveOfflineAccount(user, profile, organization);
  revokeOfflineAccount();
  assert(readOfflineAccount(saved) === null, 'sign-out revokes offline identity while retaining the snapshot');
  assert(localStorage.getItem('servesync-offline-account-v1') !== null, 'sign-out keeps cached identity for later online sign-in');

  assert(isOfflineNetworkError({ name: 'AuthRetryableFetchError', message: 'Failed to fetch' }), 'retryable fetch errors permit offline fallback');
  assert(!isOfflineNetworkError({ status: 401, message: 'Invalid Refresh Token' }), 'revoked credentials cannot be mistaken for offline');
  assert(isDefinitelyInvalidSession({ status: 401, message: 'Invalid Refresh Token' }), 'invalid refresh token revokes offline access');
} finally {
  Capacitor.getPlatform = originalPlatform;
  delete (globalThis as { window?: unknown }).window;
}

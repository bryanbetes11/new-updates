import { Capacitor } from '@capacitor/core';
import type { User } from '@supabase/supabase-js';
import type { Organization, Profile } from '../types';
import type { SavedAccount } from './savedAccounts';

const SNAPSHOT_KEY = 'servesync-offline-account-v1';
const ACTIVE_KEY = 'servesync-offline-active-v1';

export interface OfflineAccount {
  user: User;
  profile: Profile;
  organization: Organization;
  savedAt: number;
}

function storage(): Storage | null {
  try { return typeof window === 'undefined' ? null : window.localStorage; }
  catch { return null; }
}

/** A local copy is only a read-only display identity, never a server authorization claim. */
export function saveOfflineAccount(user: User, profile: Profile | null, organization: Organization | null): void {
  if (Capacitor.getPlatform() !== 'android' || !profile?.org_id || profile.id !== user.id
    || organization?.id !== profile.org_id) return;
  const local = storage();
  if (!local) return;
  try {
    local.setItem(SNAPSHOT_KEY, JSON.stringify({ user, profile, organization, savedAt: Date.now() }));
    // Write the active marker last, only after a verified online hydration.
    local.setItem(ACTIVE_KEY, user.id);
  } catch { /* An unavailable device store must not break online sign-in. */ }
}

export function revokeOfflineAccount(): void {
  try { storage()?.removeItem(ACTIVE_KEY); }
  catch { /* Best effort; callers still clear in-memory identity and cache scope. */ }
}

export function readOfflineAccount(savedAccounts: SavedAccount[], platform = Capacitor.getPlatform()): OfflineAccount | null {
  if (platform !== 'android') return null;
  try {
    const local = storage();
    const activeId = local?.getItem(ACTIVE_KEY);
    const raw = local?.getItem(SNAPSHOT_KEY);
    if (!activeId || !raw || !savedAccounts.some(account => account.userId === activeId
      && Boolean(account.session.refreshToken))) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const snapshot = value as Record<string, unknown>;
    const user = snapshot.user as User | undefined;
    const profile = snapshot.profile as Profile | undefined;
    const organization = snapshot.organization as Organization | undefined;
    if (!user || !profile || !organization || user.id !== activeId || profile.id !== activeId
      || !profile.org_id || organization.id !== profile.org_id
      || typeof snapshot.savedAt !== 'number' || !Number.isFinite(snapshot.savedAt)
      || snapshot.savedAt > Date.now()) return null;
    return { user, profile, organization, savedAt: snapshot.savedAt };
  } catch { return null; }
}

export function isOfflineNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { name?: unknown; message?: unknown; status?: unknown };
  const message = typeof value.message === 'string' ? value.message.toLowerCase() : '';
  return value.name === 'AuthRetryableFetchError' || value.status === 0
    || /failed to fetch|network|fetch failed|load failed|timed out|timeout|offline|connection/.test(message);
}

export function isDefinitelyInvalidSession(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { name?: unknown; message?: unknown; status?: unknown };
  const message = typeof value.message === 'string' ? value.message.toLowerCase() : '';
  return value.name === 'AuthSessionMissingError' || value.status === 401 || value.status === 403
    || /invalid refresh token|refresh token not found|session not found|user not found|jwt expired|invalid jwt|does not match|mismatch/.test(message);
}

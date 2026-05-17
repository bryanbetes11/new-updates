export interface SavedAccountSession {
  accessToken: string;
  refreshToken: string;
}

export interface SavedAccount {
  userId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  lastUsedAt: string;
  session: SavedAccountSession;
}

const STORAGE_KEY = 'servesync-saved-accounts';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isSavedAccount(value: unknown): value is SavedAccount {
  if (!value || typeof value !== 'object') return false;

  const record = value as Record<string, unknown>;
  const session = record.session;
  if (!session || typeof session !== 'object') return false;

  return typeof record.userId === 'string'
    && typeof record.email === 'string'
    && typeof record.displayName === 'string'
    && (typeof record.avatarUrl === 'string' || record.avatarUrl === null)
    && typeof record.lastUsedAt === 'string'
    && typeof (session as Record<string, unknown>).accessToken === 'string'
    && typeof (session as Record<string, unknown>).refreshToken === 'string';
}

export function readSavedAccounts(): SavedAccount[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(isSavedAccount)
      .sort((a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime());
  } catch {
    return [];
  }
}

export function writeSavedAccounts(accounts: SavedAccount[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

export function upsertSavedAccount(nextAccount: SavedAccount): SavedAccount[] {
  const existing = readSavedAccounts();
  const previous = existing.find(account => account.userId === nextAccount.userId);

  const merged: SavedAccount = {
    ...previous,
    ...nextAccount,
    displayName: nextAccount.displayName || previous?.displayName || nextAccount.email,
    avatarUrl: nextAccount.avatarUrl ?? previous?.avatarUrl ?? null,
  };

  const nextAccounts = [
    merged,
    ...existing.filter(account => account.userId !== nextAccount.userId),
  ].sort((a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime());

  writeSavedAccounts(nextAccounts);
  return nextAccounts;
}

export function removeSavedAccount(userId: string): SavedAccount[] {
  const nextAccounts = readSavedAccounts().filter(account => account.userId !== userId);
  writeSavedAccounts(nextAccounts);
  return nextAccounts;
}

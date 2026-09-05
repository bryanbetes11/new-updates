export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function draftRecoveryKey(kind: string, orgId?: string | null, userId?: string | null) {
  return orgId && userId ? `servesync:draft:v1:${orgId}:${userId}:${kind}` : null;
}

export function readRecovery<T>(key: string | null, validate: (value: unknown) => value is T, now = Date.now()): T | null {
  if (!key || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!Number.isFinite(saved.savedAt) || now - saved.savedAt > DRAFT_MAX_AGE_MS || saved.savedAt > now + 60000 || !validate(saved.value)) {
      window.localStorage.removeItem(key);
      return null;
    }
    return saved.value;
  } catch { return null; }
}

export function writeRecovery<T>(key: string | null, value: T | null): boolean {
  if (!key || typeof window === 'undefined') return false;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value }));
    return true;
  } catch { return false; }
}

export function mergeUntouchedFields<T extends Record<string, string>>(current: T, baseline: T, incoming: T): T {
  return Object.fromEntries(Object.keys(incoming).map(key => [key, current[key] === baseline[key] ? incoming[key] : current[key]])) as T;
}

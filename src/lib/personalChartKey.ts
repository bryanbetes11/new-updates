export function personalChartKeyStorageId(orgId?: string | null, userId?: string, songId?: string) {
  return orgId && userId && songId
    ? `servesync:personal-chart-key:${orgId}:${userId}:${songId}`
    : null;
}

export function readPersonalChartKey(storageId: string | null): string | null {
  if (!storageId) return null;
  try {
    const value = localStorage.getItem(storageId);
    return value && /^[A-G][#b]?$/.test(value) ? value : null;
  } catch { return null; }
}

export function writePersonalChartKey(storageId: string | null, key: string | null): boolean {
  if (!storageId) return false;
  try {
    if (key === null) localStorage.removeItem(storageId);
    else localStorage.setItem(storageId, key);
    return true;
  } catch { return false; }
}

export interface DeviceSnapshotRow {
  key: string;
  scope: string;
  value: unknown;
  savedAt: number;
  bytes: number;
}

export interface DeviceSnapshotStorage {
  reset(scope: string): Promise<void>;
  rows(): Promise<DeviceSnapshotRow[]>;
  put(row: DeviceSnapshotRow, removeKeys: string[]): Promise<void>;
}

export const DEVICE_SNAPSHOT_MAX_BYTES = 32 * 1024 * 1024;
const MAX_ENTRY_BYTES = 8 * 1024 * 1024;
const MAX_ENTRIES = 512;

/** Account namespaces persist across sign-out; a synchronous epoch revokes in-flight access. */
export function createDeviceSnapshotCache(storage: DeviceSnapshotStorage, now = Date.now) {
  let activeScope: string | null = null;
  let readyScope: string | null = null;
  let epoch = 0;
  let tail: Promise<unknown> = Promise.resolve();
  function queue<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
    const result = tail.then(operation).catch(() => fallback);
    tail = result;
    return result;
  }
  function activate(scope: string | null) {
    if (scope === activeScope && scope === readyScope && scope !== null) return tail.then(() => undefined);
    activeScope = scope;
    readyScope = null;
    epoch += 1;
    const capturedEpoch = epoch;
    return queue(async () => {
      if (capturedEpoch === epoch) readyScope = scope;
    }, undefined);
  }
  function read<T>(scope: string | null, key: string): Promise<{ value: T; savedAt: number } | null> {
    const capturedEpoch = epoch;
    return queue(async () => {
      if (!scope || scope !== activeScope || scope !== readyScope || capturedEpoch !== epoch) return null;
      const row = (await storage.rows()).find(entry => entry.scope === scope && entry.key === JSON.stringify([scope, key]));
      if (scope !== activeScope || capturedEpoch !== epoch || !row || !Number.isFinite(row.savedAt)
        || row.savedAt > now()) return null;
      return { value: row.value as T, savedAt: row.savedAt };
    }, null);
  }
  function write<T>(scope: string | null, key: string, value: T) {
    const capturedEpoch = epoch;
    // Detach from caller-owned objects before entering the asynchronous queue.
    let row: DeviceSnapshotRow;
    if (!scope) return Promise.resolve();
    try {
      const json = JSON.stringify(value);
      const bytes = new TextEncoder().encode(json).byteLength;
      if (!json || bytes > MAX_ENTRY_BYTES) return Promise.resolve();
      row = { key: JSON.stringify([scope, key]), scope, value: JSON.parse(json), bytes, savedAt: now() };
    } catch { return Promise.resolve(); }
    return queue(async () => {
      if (!scope || scope !== activeScope || scope !== readyScope || capturedEpoch !== epoch) return;
      const rows = await storage.rows();
      if (scope !== activeScope || capturedEpoch !== epoch) return;
      const keep = rows.filter(entry => entry.key !== row.key && Number.isFinite(entry.savedAt))
        .sort((a, b) => b.savedAt - a.savedAt);
      let bytes = row.bytes;
      const retained = new Set<string>([row.key]);
      for (const entry of keep) {
        if (retained.size >= MAX_ENTRIES || bytes + entry.bytes > DEVICE_SNAPSHOT_MAX_BYTES) continue;
        bytes += entry.bytes;
        retained.add(entry.key);
      }
      await storage.put(row, rows.filter(entry => !retained.has(entry.key)).map(entry => entry.key));
    }, undefined);
  }
  function clear(scope: string | null) {
    if (!scope || scope !== activeScope) return Promise.resolve();
    epoch += 1;
    readyScope = null;
    const capturedEpoch = epoch;
    return queue(async () => {
      if (scope === activeScope) {
        await storage.reset(scope);
        if (capturedEpoch === epoch) readyScope = scope;
      }
      return true;
    }, false).then(success => { if (!success) throw new Error('Could not clear saved data'); });
  }
  return { activate, read, write, clear };
}

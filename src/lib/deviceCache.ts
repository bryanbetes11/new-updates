import { Capacitor } from '@capacitor/core';
import { createDeviceSnapshotCache, type DeviceSnapshotRow } from './deviceCacheStore';

const DATABASE_NAME = 'servesync-device-cache-v1';
let database: Promise<IDBDatabase> | undefined;
function openDatabase() {
  if (!database) database = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('snapshots', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Device cache unavailable'));
  }).catch(error => { database = undefined; throw error; });
  return database;
}
async function transaction<T>(stores: string[], mode: IDBTransactionMode, run: (tx: IDBTransaction, done: (value: T) => void) => void): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let result: T;
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    run(tx, value => { result = value; });
  });
}

const cache = createDeviceSnapshotCache({
  reset: (scope, keys) => transaction<void>(['snapshots'], 'readwrite', tx => {
    const store = tx.objectStore('snapshots');
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if (cursor.value.scope === scope && (!keys || keys.includes(cursor.value.key))) cursor.delete();
      cursor.continue();
    };
  }),
  rows: () => transaction<DeviceSnapshotRow[]>(['snapshots'], 'readonly', (tx, done) => {
    const request = tx.objectStore('snapshots').getAll();
    request.onsuccess = () => done(request.result);
  }),
  put: (row, removeKeys) => transaction<void>(['snapshots'], 'readwrite', tx => {
    const store = tx.objectStore('snapshots');
    removeKeys.forEach(key => store.delete(key));
    store.put(row);
  }),
});

export function deviceCacheScope(userId: string | null | undefined, orgId: string | null | undefined): string | null {
  return Capacitor.getPlatform() === 'android' && userId && orgId ? JSON.stringify([userId, orgId]) : null;
}
export function setDeviceCacheScope(scope: string | null): Promise<void> {
  return Capacitor.getPlatform() === 'android' ? cache.activate(scope) : Promise.resolve();
}
export function readDeviceSnapshot<T>(scope: string | null, key: string): Promise<{ value: T; savedAt: number } | null> {
  return scope ? cache.read<T>(scope, key) : Promise.resolve(null);
}
export function writeDeviceSnapshot<T>(scope: string | null, key: string, value: T): Promise<void> {
  return scope ? cache.write(scope, key, value) : Promise.resolve();
}
export function invalidateDeviceSnapshots(scope: string | null, keys?: string[]): Promise<void> {
  // Cache availability must never turn a successful server edit into a failed save.
  return cache.clear(scope, keys).catch(() => undefined);
}
export function clearDeviceSnapshots(scope: string | null): Promise<void> {
  return cache.clear(scope);
}

export function listDeviceSnapshots<T>(scope: string | null, prefix: string): Promise<Array<{ key: string; value: T; savedAt: number }>> {
  return scope ? cache.list<T>(scope, prefix) : Promise.resolve([]);
}

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { deviceCacheScope, clearDeviceSnapshots } from '../lib/deviceCache';
import { clearNativeImageCache } from '../lib/nativeImageCache';
import { isAndroidApp } from '../lib/nativeAppUpdates';

export function DeviceCacheSetting() {
  const { user, profile } = useAuth();
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState('');
  if (!isAndroidApp()) return null;
  const clear = async () => {
    setClearing(true);
    setMessage('');
    try {
      await Promise.all([
        clearDeviceSnapshots(deviceCacheScope(user?.id, profile?.org_id)),
        clearNativeImageCache(),
      ]);
      setMessage('Saved cache cleared. Content will be saved again as you browse.');
    } catch {
      setMessage('Could not clear all saved content. Please try again.');
    } finally { setClearing(false); }
  };
  return (
    <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 sm:p-5">
      <h2 className="text-sm font-bold text-gray-900 dark:text-white">Saved on this device</h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        The home page, songs, sets, videos, nearby event details and approved charts, and images you view are saved for faster loading. The app checks for fresh data when you return.
        Each account and church has its own saved cache, kept when you sign out or switch accounts.
        Saved data has no time limit and can use up to 512 MB across accounts. Older content is removed when the cache fills up. Space is used only as content is saved.
      </p>
      <button type="button" disabled={clearing} onClick={() => void clear()} className="btn-secondary mt-3 text-sm">
        {clearing ? 'Clearing…' : 'Clear this account’s cache'}
      </button>
      {message && <p role="status" className="mt-2 text-sm text-gray-600 dark:text-gray-400">{message}</p>}
    </section>
  );
}

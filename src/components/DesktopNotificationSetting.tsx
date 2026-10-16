import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { desktopAlertPermission, desktopAlertsEnabled, sendDesktopAlert, setDesktopAlertsEnabled } from '../lib/desktopNotifications';
import { desktopPlatformName } from '../lib/desktopPlatform';

export function DesktopNotificationSetting({ onEnabled }: { onEnabled?: () => void }) {
  const platform = desktopPlatformName();
  const { user, profile } = useAuth();
  const scope = user && profile?.org_id ? { userId: user.id, orgId: profile.org_id } : null;
  const scopeId = scope ? `${scope.orgId}:${scope.userId}` : '';
  const current = useRef(scopeId);
  current.current = scopeId;
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    setEnabled(scope ? desktopAlertsEnabled(scope) : false);
    setMessage('');
    // Only reset when the account changes, not on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeId]);
  const act = async (test = false) => {
    if (!scope || busy) return;
    setBusy(true); setMessage('');
    try {
      if (enabled && !test) {
        setDesktopAlertsEnabled(scope, false); setEnabled(false); return;
      }
      if (!await desktopAlertPermission(true)) throw new Error(platform === 'Mac'
        ? 'Allow ServeSync in System Settings → Notifications.'
        : 'Allow ServeSync notifications in Windows Settings → System → Notifications.');
      if (current.current !== scopeId) return;
      if (test) {
        await sendDesktopAlert(true);
        setMessage(platform === 'Mac' ? 'Test requested. If no alert appears, check Mac notification settings and Focus.' : 'Test requested. If no alert appears, check Windows notification settings and Do not disturb.');
      } else {
        setDesktopAlertsEnabled(scope, true); setEnabled(true); onEnabled?.();
      }
    } catch (error) {
      if (current.current === scopeId) setMessage(error instanceof Error ? error.message : 'Could not enable notifications. Try again.');
    } finally { setBusy(false); }
  };
  return <div className="space-y-3 text-sm">
    <div className="flex items-center gap-3">
      <Bell className="h-5 w-5 shrink-0 text-emerald-600" />
      <div className="flex-1"><p className="font-bold text-gray-900 dark:text-white">{platform} notifications</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Receive alerts while ServeSync is open or minimized.</p></div>
      <button type="button" disabled={busy || !scope} onClick={() => void act()} className="rounded-full bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-700 disabled:opacity-50">{busy ? 'Please wait…' : enabled ? 'Disable' : 'Enable'}</button>
    </div>
    {enabled && <button type="button" disabled={busy} onClick={() => void act(true)} className="font-semibold text-emerald-700 underline dark:text-emerald-400">Test notification</button>}
    <p className="text-xs text-gray-500 dark:text-gray-400">Applies to this account on this computer. Closing the app stops alerts.</p>
    {message && <p role="status" className="text-xs text-gray-600 dark:text-gray-300">{message}</p>}
  </div>;
}

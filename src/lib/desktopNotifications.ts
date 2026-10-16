import { isDesktopApp } from './desktopPlatform';

export type DesktopNotificationScope = { userId: string; orgId: string };
const preferenceKey = ({ userId, orgId }: DesktopNotificationScope) => `servesync:desktop-alerts:${orgId}:${userId}`;
export function desktopAlertsEnabled(scope: DesktopNotificationScope) {
  try { return localStorage.getItem(preferenceKey(scope)) === 'on'; } catch { return false; }
}
export function setDesktopAlertsEnabled(scope: DesktopNotificationScope, enabled: boolean) {
  localStorage.setItem(preferenceKey(scope), enabled ? 'on' : 'off');
  window.dispatchEvent(new Event('push-readiness-updated'));
}
export async function desktopAlertPermission(request = false) {
  if (!isDesktopApp()) return false;
  const api = await import('@tauri-apps/plugin-notification');
  return await api.isPermissionGranted() || (request && await api.requestPermission() === 'granted');
}
export async function sendDesktopAlert(test = false) {
  const { invoke } = await import('@tauri-apps/api/core');
  // Await the native command so a failed request can be reported to the user.
  await invoke('plugin:notification|notify', { options: {
    title: test ? 'ServeSync test notification' : 'ServeSync',
    body: test ? 'Notifications are working on this computer.' : 'You have a new notification. Open ServeSync to view it.',
  } });
}

export type DesktopAlertRow = {
  id: string; user_id: string; org_id: string; created_at: string;
  scheduled_for?: string | null; is_read: boolean; dismissed_at?: string | null;
  delivery_channels?: { push?: boolean };
};
export function createDesktopAlertDelivery(scope: DesktopNotificationScope, deps: {
  active: () => boolean; enabled: () => boolean; permission: () => Promise<boolean>;
  send: () => Promise<void>; now: () => number;
}) {
  const started = deps.now();
  const seen = new Map<string, number>();
  const pending = new Set<string>();
  return async (row: DesktopAlertRow) => {
    const now = deps.now();
    for (const [id, at] of seen) if (at < now - 600_000) seen.delete(id);
    const created = Date.parse(row.created_at);
    if (!deps.active() || !deps.enabled() || row.user_id !== scope.userId || row.org_id !== scope.orgId
      || !row.id || row.is_read || row.dismissed_at || row.delivery_channels?.push !== true
      || !Number.isFinite(created) || created < started || created < now - 120_000 || created > now + 30_000
      || (row.scheduled_for && !(Date.parse(row.scheduled_for) <= now))
      || seen.has(row.id) || pending.has(row.id)) return;
    pending.add(row.id);
    try {
      if (!await deps.permission() || !deps.active() || !deps.enabled()) return;
      await deps.send();
      seen.set(row.id, now);
    } finally { pending.delete(row.id); }
  };
}

import { supabase } from './supabase';
import { isNotificationId, notificationOpenParam, type NotificationOpenSource } from './notificationActivity';

const pendingPushKey = 'servesync:pending-push-open';
type PendingOpen = { id: string; source: NotificationOpenSource; queuedAt: number };
const inFlight = new Set<string>();
const queueKey = (userId: string) => `servesync:notification-opens:${userId}`;
function readQueue(userId: string): PendingOpen[] {
  try {
    const data = JSON.parse(localStorage.getItem(queueKey(userId)) || '[]');
    return Array.isArray(data) ? data.filter(item => isNotificationId(item?.id)
      && ['push', 'bell', 'page'].includes(item.source) && item.queuedAt > Date.now() - 7 * 86400000).slice(-100) : [];
  } catch { return []; }
}
function writeQueue(userId: string, entries: PendingOpen[]) {
  try { localStorage.setItem(queueKey(userId), JSON.stringify(entries)); } catch { /* Tracking must not block navigation. */ }
}

// Capture before the router/auth redirects can discard the push's query parameter.
export function capturePushNotificationOpen() {
  const url = new URL(window.location.href);
  const id = url.searchParams.get(notificationOpenParam);
  if (!id) return;
  if (isNotificationId(id)) {
    try { sessionStorage.setItem(pendingPushKey, id); } catch { /* Best effort on restricted devices. */ }
  }
  url.searchParams.delete(notificationOpenParam);
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
}

export async function flushNotificationOpens(userId: string) {
  if (inFlight.has(userId) || !navigator.onLine) return;
  inFlight.add(userId);
  try {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const entry = readQueue(userId)[0];
      if (!entry) break;
      // Never attribute queued clicks to a different account after an account switch.
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user.id !== userId) break;
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 8000);
      let error;
      try {
        ({ error } = await supabase.rpc('record_notification_open', { p_notification_id: entry.id, p_source: entry.source }).abortSignal(controller.signal));
      } finally { window.clearTimeout(timeout); }
      if (error) break; // Retry transient/offline failures on resume; never delay opening the destination.
      writeQueue(userId, readQueue(userId).filter(item => !(item.id === entry.id && item.source === entry.source)));
    }
  } catch { /* Keep queued events for the next connection/resume. */ }
  finally { inFlight.delete(userId); }
}

export function recordNotificationOpen(userId: string | undefined, id: string, source: NotificationOpenSource) {
  if (!userId || !isNotificationId(id)) return;
  const entries = readQueue(userId);
  if (!entries.some(entry => entry.id === id && entry.source === source)) {
    entries.push({ id, source, queuedAt: Date.now() });
    writeQueue(userId, entries.slice(-100));
  }
  void flushNotificationOpens(userId);
}

export function consumePushNotificationOpen(userId: string) {
  try {
    const id = sessionStorage.getItem(pendingPushKey);
    if (isNotificationId(id)) recordNotificationOpen(userId, id, 'push');
    sessionStorage.removeItem(pendingPushKey);
  } catch { /* Best effort. */ }
}

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { App } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';
import type { PluginListenerHandle } from '@capacitor/core';
import { useAuth } from '../contexts/AuthContext';
import { androidPushAvailable, nativePushChanged, onboardNativePush, reconcileNativePush, refreshNativePushToken } from '../lib/nativePush';
import { nativePushDestination } from '../lib/nativePushController';
import { recordNotificationOpen } from '../lib/notificationOpenTracking';

export function NativePushBridge() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const pending = useRef<Record<string, unknown> | null>(null);
  const current = useRef({ userId: user?.id, orgId: profile?.org_id, loading });
  current.current = { userId: user?.id, orgId: profile?.org_id, loading };
  const sync = async () => {
    const { userId, orgId, loading: busy } = current.current;
    if (busy) return;
    await reconcileNativePush(userId ?? null);
    if (userId && orgId && current.current.userId === userId) await onboardNativePush(userId);
    window.dispatchEvent(new Event(nativePushChanged));
  };
  const syncRef = useRef(sync);
  syncRef.current = sync;
  const open = useRef((data: Record<string, unknown>) => {
    const { userId, loading: busy } = current.current;
    if (busy) { pending.current = data; return; }
    pending.current = null;
    if (!userId) return;
    const path = nativePushDestination(data, userId);
    if (!path) return;
    if (typeof data.notification_id === 'string') recordNotificationOpen(userId, data.notification_id, 'push');
    navigate(path);
  });

  useEffect(() => {
    if (!androidPushAvailable()) return;
    let disposed = false;
    const handles: PluginListenerHandle[] = [];
    const keep = async (promise: Promise<PluginListenerHandle>) => {
      const handle = await promise;
      if (disposed) await handle.remove(); else handles.push(handle);
    };
    const refresh = () => {
      if (current.current.loading) return;
      void syncRef.current()
        .catch(() => { /* Retry on resume/online; settings shows registration errors. */ });
    };
    void keep(PushNotifications.addListener('pushNotificationActionPerformed', action => open.current(action.notification.data ?? {})));
    void keep(PushNotifications.addListener('registration', token => { void refreshNativePushToken(token.value).catch(() => undefined); }));
    void keep(App.addListener('appStateChange', state => { if (state.isActive) refresh(); }));
    window.addEventListener('online', refresh);
    return () => {
      disposed = true;
      window.removeEventListener('online', refresh);
      void Promise.all(handles.map(handle => handle.remove()));
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    if (pending.current) open.current(pending.current);
    void syncRef.current().catch(() => undefined);
  }, [loading, user?.id, profile?.org_id]);
  return null;
}

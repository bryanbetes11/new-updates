import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { isDesktopApp } from '../lib/desktopPlatform';
import { createDesktopAlertDelivery, desktopAlertPermission, desktopAlertsEnabled, sendDesktopAlert, type DesktopAlertRow } from '../lib/desktopNotifications';

export function DesktopNotificationBridge() {
  const { user, profile } = useAuth();
  const userId = user?.id;
  const orgId = profile?.org_id;
  const identity = `${orgId}:${userId}`;
  const current = useRef(identity);
  current.current = identity;
  useEffect(() => {
    if (!isDesktopApp() || !userId || !orgId) return;
    let disposed = false;
    let polling = false;
    const scope = { userId, orgId };
    const started = Date.now();
    const deliver = createDesktopAlertDelivery(scope, {
      active: () => !disposed && current.current === identity,
      enabled: () => desktopAlertsEnabled(scope), permission: desktopAlertPermission,
      send: () => sendDesktopAlert(), now: Date.now,
    });
    const receive = (row: DesktopAlertRow) => deliver(row).catch(() => { /* Retry recent alerts on the next poll. */ });
    const channel = supabase.channel(`desktop-alerts:${orgId}:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, payload => { void receive(payload.new as DesktopAlertRow); })
      .subscribe();
    // A bounded catch-up query covers a missed realtime connection without replaying old alerts.
    const poll = async () => {
      if (polling || disposed || !desktopAlertsEnabled(scope)) return;
      polling = true;
      try {
        const { data, error } = await supabase.from('notifications')
          .select('id,user_id,org_id,created_at,scheduled_for,is_read,dismissed_at,delivery_channels')
          .eq('user_id', userId).eq('org_id', orgId).eq('is_read', false).is('dismissed_at', null)
          .contains('delivery_channels', { push: true })
          .gte('created_at', new Date(Math.max(started, Date.now() - 120_000)).toISOString())
          .order('created_at', { ascending: false }).limit(50);
        if (!error && !disposed) for (const row of data ?? []) await receive(row as DesktopAlertRow);
      } finally { polling = false; }
    };
    const refresh = () => { void poll().catch(() => undefined); };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('online', refresh);
    return () => { disposed = true; clearInterval(timer); window.removeEventListener('online', refresh); void supabase.removeChannel(channel); };
  }, [identity, userId, orgId]);
  return null;
}

import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { isIosDevice, isStandalonePwa } from '../lib/device';
import { VAPID_PUBLIC_KEY } from '../lib/push';

interface PushNotificationSettingProps {
  surface?: 'profile' | 'drawer';
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export function PushNotificationSetting({ surface = 'profile' }: PushNotificationSettingProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  const savePushSubscription = useCallback(async (subscription: PushSubscription) => {
    if (!user) return;

    const subJson = subscription.toJSON();
    const { error } = await supabase.rpc('claim_push_subscription', {
      p_endpoint: subJson.endpoint || '',
      p_p256dh: subJson.keys?.p256dh || '',
      p_auth_key: subJson.keys?.auth || '',
    });

    if (error) throw error;
  }, [user]);

  useEffect(() => {
    if (!user || typeof window === 'undefined') return;

    const checkPushStatus = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setPushEnabled(false);
        return;
      }

      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setPushEnabled(!!sub && Notification.permission === 'granted');
      } catch {
        setPushEnabled(false);
      }
    };

    checkPushStatus();
  }, [user]);

  useEffect(() => {
    if (!user || !pushEnabled || typeof window === 'undefined') return;
    let cancelled = false;

    const syncExistingSubscription = async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();

        if (!cancelled && sub && Notification.permission === 'granted') {
          await savePushSubscription(sub);
        }
      } catch {
        // Push sync is best-effort and should not block the settings drawer.
      }
    };

    syncExistingSubscription();
    return () => { cancelled = true; };
  }, [pushEnabled, savePushSubscription, user]);

  const togglePush = async () => {
    if (!user || typeof window === 'undefined') return;

    setPushLoading(true);

    if (!pushEnabled) {
      try {
        if (!('serviceWorker' in navigator)) {
          toast('error', 'Service workers not supported');
          return;
        }

        if (!('PushManager' in window)) {
          toast('error', isIosDevice() && !isStandalonePwa() ? 'On iOS, add to Home Screen first.' : 'Push not supported in this browser');
          return;
        }

        if (!('Notification' in window)) {
          toast('error', 'Notifications unavailable');
          return;
        }

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          toast('error', 'Permission denied. Enable in settings.');
          return;
        }

        const reg = await navigator.serviceWorker.ready;
        if (!VAPID_PUBLIC_KEY) {
          toast('error', 'Push not configured');
          return;
        }

        const sub = await reg.pushManager.getSubscription()
          || await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          });

        await savePushSubscription(sub);
        setPushEnabled(true);
        toast('success', 'Push notifications enabled');
      } catch (err) {
        toast('error', err instanceof Error ? err.message : 'Failed to enable');
      } finally {
        setPushLoading(false);
      }
      return;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

      if (sub) {
        await sub.unsubscribe();
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', sub.endpoint);
      }

      setPushEnabled(false);
      toast('info', 'Push notifications disabled');
    } catch {
      toast('error', 'Failed to disable');
    } finally {
      setPushLoading(false);
    }
  };

  const statusText = pushEnabled
    ? 'Enabled for this device'
    : typeof window !== 'undefined' && !('PushManager' in window) && isIosDevice() && !isStandalonePwa()
      ? 'Add to Home Screen to enable'
      : 'Allow alerts for assignments and messages';

  const isDrawer = surface === 'drawer';

  return (
    <div
      className={isDrawer
        ? 'rounded-[1.4rem] border border-white/[0.08] bg-white/[0.045] px-3.5 py-3.5'
        : 'relative overflow-hidden rounded-3xl border border-gray-200/80 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_6px_20px_-12px_rgba(15,23,42,0.10)] dark:border-white/[0.06] dark:bg-white/[0.025]'}
    >
      {!isDrawer && (
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-black/[0.06] to-transparent dark:via-white/[0.12]" />
      )}

      <div className="flex items-center gap-3">
        <div
          className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
            pushEnabled ? '' : isDrawer ? 'bg-white/[0.06]' : 'bg-gray-100 dark:bg-white/[0.06]'
          }`}
          style={pushEnabled ? { background: 'linear-gradient(145deg, #16a34a, #15803d)', boxShadow: '0 3px 10px rgba(22,163,74,0.3)' } : undefined}
        >
          {pushEnabled
            ? <Bell className="h-5 w-5 text-white" />
            : <BellOff className={isDrawer ? 'h-5 w-5 text-white/38' : 'h-5 w-5 text-gray-400 dark:text-white/30'} />}
          {pushEnabled && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#0d0d0f]" style={{ boxShadow: '0 0 8px rgba(34,197,94,0.6)' }} />}
        </div>

        <div className="min-w-0 flex-1">
          <p className={isDrawer ? 'text-[14px] font-black text-white' : 'text-[14px] font-bold text-gray-900 dark:text-white'} style={{ letterSpacing: '-0.015em' }}>
            Push Notifications
          </p>
          <p className={isDrawer ? 'mt-0.5 text-[11px] font-semibold text-white/45' : 'mt-0.5 text-[12px] text-gray-500 dark:text-white/45'}>
            {statusText}
          </p>
        </div>

        <button
          type="button"
          onClick={togglePush}
          disabled={pushLoading}
          className={`inline-flex h-9 shrink-0 items-center justify-center rounded-full px-3.5 text-[12px] font-black transition-all active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 ${
            pushEnabled
              ? isDrawer
                ? 'border border-white/[0.10] bg-white/[0.06] text-white/68 hover:bg-white/[0.09]'
                : 'border border-black/[0.06] bg-white/70 text-gray-600 hover:bg-white dark:border-white/[0.07] dark:bg-white/[0.04] dark:text-white/55 dark:hover:bg-white/[0.07]'
              : 'text-white'
          }`}
          style={!pushEnabled ? { background: 'linear-gradient(135deg, #16a34a, #15803d)', boxShadow: '0 4px 14px rgba(22,163,74,0.35)' } : undefined}
        >
          {pushLoading ? 'Working...' : pushEnabled ? 'Disable' : 'Enable'}
        </button>
      </div>
    </div>
  );
}

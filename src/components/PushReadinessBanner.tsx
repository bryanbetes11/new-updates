import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, BellOff, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isIosDevice, isStandalonePwa } from '../lib/device';
import { supabase } from '../lib/supabase';

export function PushReadinessBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ready, setReady] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const checkReadiness = useCallback(async () => {
    if (!user || typeof window === 'undefined') return;

    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setReady(false);
      return;
    }

    try {
      const [registration, preferenceResult] = await Promise.all([
        navigator.serviceWorker.ready,
        supabase
          .from('notification_preferences')
          .select('push_enabled')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);
      const subscription = await registration.pushManager.getSubscription();
      const preferenceEnabled = preferenceResult.data?.push_enabled ?? true;
      setReady(Boolean(subscription) && Notification.permission === 'granted' && preferenceEnabled);
    } catch {
      setReady(false);
    }
  }, [user]);

  useEffect(() => {
    checkReadiness();
    const handleUpdate = (event: Event) => {
      const enabled = (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled;
      if (typeof enabled === 'boolean') setReady(enabled);
      else checkReadiness();
    };
    window.addEventListener('push-readiness-updated', handleUpdate);
    return () => window.removeEventListener('push-readiness-updated', handleUpdate);
  }, [checkReadiness]);

  if (!user || ready !== false || dismissed) return null;

  const message = isIosDevice() && !isStandalonePwa()
    ? 'Add ServeSync to your Home Screen, then enable notifications so reminders reach you on time.'
    : 'Enable push notifications so assignments, attendance reminders, and team updates reach this device.';

  return (
    <div className="mx-4 mb-3 mt-3 flex max-w-7xl items-center gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/[0.10] px-4 py-3 text-white shadow-lg shadow-black/10 sm:mx-auto">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300">
        <BellOff className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black">Push notifications are not ready</p>
        <p className="mt-0.5 text-xs leading-5 text-white/55">{message}</p>
      </div>
      <button
        type="button"
        onClick={() => navigate('/settings/notifications?setup=push')}
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-400 px-3 py-2 text-xs font-black text-black transition hover:bg-amber-300"
      >
        Set up <ArrowRight className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss push notification reminder"
        className="rounded-full p-1.5 text-white/35 transition hover:bg-white/[0.08] hover:text-white/70"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

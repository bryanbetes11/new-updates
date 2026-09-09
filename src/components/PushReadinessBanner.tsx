import { useCallback, useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isIosDevice, isStandalonePwa } from '../lib/device';
import { supabase } from '../lib/supabase';

type PushReadinessBannerProps = {
  variant?: 'default' | 'chat';
};

export function PushReadinessBanner({ variant = 'default' }: PushReadinessBannerProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ready, setReady] = useState<boolean | null>(null);

  const checkReadiness = useCallback(async () => {
    if (!user || typeof window === 'undefined') return;

    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setReady(false);
      return;
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        setReady(false);
        return;
      }
      const { data: preference } = await supabase
        .from('notification_preferences')
        .select('push_enabled')
        .eq('user_id', user.id)
        .maybeSingle();
      const subscription = await registration.pushManager.getSubscription();
      const preferenceEnabled = preference?.push_enabled ?? true;
      setReady(Boolean(subscription) && Notification.permission === 'granted' && preferenceEnabled);
    } catch {
      setReady(false);
    }
  }, [user]);

  useEffect(() => {
    checkReadiness();
    const handleUpdate = (event: Event) => {
      const enabled = (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled;
      if (typeof enabled === 'boolean') {
        setReady(enabled);
      }
      else checkReadiness();
    };
    window.addEventListener('push-readiness-updated', handleUpdate);
    return () => window.removeEventListener('push-readiness-updated', handleUpdate);
  }, [checkReadiness]);

  if (!user || ready !== false) return null;

  const message = isIosDevice() && !isStandalonePwa()
    ? 'Add ServeSync to your Home Screen, then enable notifications so reminders reach you on time.'
    : 'Enable push notifications so assignments, attendance reminders, and team updates reach this device.';
  const reminderNote = 'This reminder stays visible until notifications are enabled.';

  if (variant === 'chat') {
    return (
      <button
        type="button"
        onClick={() => navigate('/settings/notifications?setup=push')}
        className="sticky top-0 z-20 -mx-2 mb-1 flex w-[calc(100%+1rem)] items-center gap-3 border-b border-red-400/20 bg-[#21090c]/[0.98] px-3 py-3 text-left shadow-[0_10px_24px_-22px_rgba(0,0,0,0.9)] backdrop-blur-xl transition hover:bg-red-400/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-300 dark:bg-[#21090c]/[0.98]"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-black text-white">Push notifications are not ready</span>
          <span className="mt-0.5 block truncate text-[12px] text-white/55">Set up notifications to clear this reminder.</span>
        </span>
        <span className="rounded-full bg-red-500 px-2.5 py-1.5 text-[11px] font-black text-white">Set up</span>
      </button>
    );
  }

  return (
    <>
      <div aria-hidden="true" className="h-[224px] lg:hidden" />
      <div className="pointer-events-none fixed inset-x-0 top-[calc(3.5rem+env(safe-area-inset-top))] z-50 bg-[#25090d] p-4 text-white shadow-lg shadow-black/25 lg:static lg:mx-[30px] lg:flex lg:max-w-none lg:items-center lg:gap-3 lg:rounded-2xl lg:px-4 lg:py-3 lg:shadow-lg">
        <div className="lg:min-w-0 lg:flex-1">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-black lg:text-sm">Push notifications are not ready</p>
            <p className="mt-1 text-[13px] leading-5 text-white/60 lg:mt-0.5 lg:text-xs">{message} {reminderNote}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/settings/notifications?setup=push')}
          className="pointer-events-auto mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-500 px-4 text-[13px] font-black text-white transition hover:bg-red-400 active:scale-[0.98] lg:mt-0 lg:h-auto lg:w-auto lg:shrink-0 lg:rounded-full lg:px-3 lg:py-2 lg:text-xs"
        >
          <span className="lg:hidden">Allow My Notifications</span>
          <span className="hidden lg:inline">Set up</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </>
  );
}

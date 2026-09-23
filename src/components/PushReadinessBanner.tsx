import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Frown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isIosDevice, isStandalonePwa } from '../lib/device';
import { supabase } from '../lib/supabase';
import { isNativeApp } from '../lib/nativePlatform';
import { nativePushChanged, nativePushReadiness, openNativePushSettingsIfBlocked } from '../lib/nativePush';

type PushReadinessBannerProps = {
  variant?: 'default' | 'chat';
  onVisibilityChange?: (visible: boolean) => void;
};

export function PushReadinessBanner({ variant = 'default', onVisibilityChange }: PushReadinessBannerProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ready, setReady] = useState<boolean | null>(null);

  const checkReadiness = useCallback(async () => {
    if (!user || typeof window === 'undefined') return;
    if (isNativeApp()) {
      try { setReady(await nativePushReadiness(user.id)); }
      catch { setReady(null); }
      return;
    }

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
    window.addEventListener(nativePushChanged, checkReadiness);
    window.addEventListener('focus', checkReadiness);
    const handleVisibility = () => { if (document.visibilityState === 'visible') void checkReadiness(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('push-readiness-updated', handleUpdate);
      window.removeEventListener(nativePushChanged, checkReadiness);
      window.removeEventListener('focus', checkReadiness);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [checkReadiness]);

  useEffect(() => {
    onVisibilityChange?.(Boolean(user && ready === false));
  }, [onVisibilityChange, ready, user]);

  if (!user || ready !== false) return null;

  const setup = async () => {
    try { if (await openNativePushSettingsIfBlocked()) return; }
    catch { /* The setup screen includes the manual recovery path. */ }
    navigate('/settings/notifications?setup=push');
  };

  const message = !isNativeApp() && isIosDevice() && !isStandalonePwa()
    ? 'Add ServeSync to your Home Screen to turn on alerts.'
    : 'Get alerts for messages and reminders.';

  if (variant === 'chat') {
    return (
      <button
        type="button"
        onClick={setup}
        className="sticky top-0 z-20 -mx-2 mb-1 flex w-[calc(100%+1rem)] items-center gap-3 border-b border-red-400/20 bg-[#21090c]/[0.98] px-3 py-3 text-left shadow-[0_10px_24px_-22px_rgba(0,0,0,0.9)] backdrop-blur-xl transition hover:bg-red-400/[0.09] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-300 dark:bg-[#21090c]/[0.98]"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-black text-white">Notifications are off</span>
          <span className="mt-0.5 block text-[12px] text-white/55">You won’t receive lock-screen message alerts. Enable notifications to stay updated.</span>
        </span>
        <span className="rounded-full bg-red-500 px-2.5 py-1.5 text-[11px] font-black text-white">Set up</span>
      </button>
    );
  }

  return (
      <div className="relative flex items-center gap-3 bg-[#25090d] px-4 py-3 text-white shadow-lg shadow-black/25 lg:mx-[30px] lg:rounded-2xl">
        <Frown aria-hidden="true" className="h-6 w-6 shrink-0 text-red-300" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-black">Notifications are off</p>
          <p className="mt-0.5 text-[12px] leading-4 text-white/65">{message}</p>
        </div>
        <button
          type="button"
          onClick={setup}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1 rounded-xl bg-red-500 px-3 text-[12px] font-black text-white transition hover:bg-red-400 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white lg:rounded-full"
        >
          <span>Set up</span>
          <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </div>
  );
}

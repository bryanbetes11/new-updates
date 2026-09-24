import { useCallback, useEffect, useState } from 'react';
import { Frown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isIosDevice, isStandalonePwa } from '../lib/device';
import { supabase } from '../lib/supabase';
import { isNativeApp } from '../lib/nativePlatform';
import { nativePushChanged, nativePushReadiness, openNativePushSettingsIfBlocked } from '../lib/nativePush';

type PushReadinessBannerProps = {
  onVisibilityChange?: (visible: boolean) => void;
};

export function PushReadinessBanner({ onVisibilityChange }: PushReadinessBannerProps) {
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
    : <>Get notified when you receive{' '}<br className="sm:hidden" />new messages or reminders.</>;

  return (
      <div className="relative flex items-center gap-3 bg-[#25090d] px-4 py-3 text-white shadow-lg shadow-black/25 lg:mx-[30px] lg:rounded-2xl">
        <Frown aria-hidden="true" className="mr-1 h-12 w-12 shrink-0 text-red-300 sm:mr-0 sm:h-6 sm:w-6" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-black">Turn On Notifications</p>
          <p className="mt-0.5 text-[12px] leading-4 text-white/65">{message}</p>
        </div>
        <button
          type="button"
          onClick={setup}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1 rounded-xl bg-red-500 px-3 text-[12px] font-black capitalize text-white transition hover:bg-red-400 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white lg:rounded-full"
        >
          <span>Turn On</span>
        </button>
      </div>
  );
}

import { useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AndroidAppOfferContext } from '../contexts/androidAppOfferContext';
import { isAndroidDevice, isStandalonePwa } from '../lib/device';
import { isNativeApp } from '../lib/nativePlatform';
import { shouldOfferAndroidApp } from '../lib/androidDownload';
import { supabase } from '../lib/supabase';

export function AndroidAppOfferProvider({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  const { pathname } = useLocation();
  const [availableFor, setAvailableFor] = useState<string | null>(null);
  const eligible = shouldOfferAndroidApp({ android: isAndroidDevice(), standalone: isStandalonePwa(), native: isNativeApp(), signedIn: Boolean(user) && !loading, dashboard: pathname === '/dashboard', dismissed: false });
  const owner = user?.id && profile?.org_id ? `${user.id}:${profile.org_id}` : null;
  useEffect(() => {
    setAvailableFor(null);
    if (!eligible || !owner) return;
    const controller = new AbortController();
    let pending = false;
    let installed = false;
    const refresh = async () => {
      if (pending || installed || controller.signal.aborted || document.visibilityState !== 'visible' || !navigator.onLine) return;
      pending = true;
      try {
        const { data, error } = await supabase.rpc('has_used_android_app').abortSignal(controller.signal);
        if (controller.signal.aborted) return;
        if (error || typeof data !== 'boolean') { setAvailableFor(null); return; }
        installed = data;
        setAvailableFor(installed ? null : owner);
      } catch { if (!controller.signal.aborted) setAvailableFor(null); }
      finally { pending = false; }
    };
    const check = () => { void refresh(); };
    check();
    const interval = window.setInterval(check, 5 * 60_000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('online', check);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('online', check);
    };
  }, [eligible, owner]);
  return <AndroidAppOfferContext.Provider value={eligible && owner !== null && availableFor === owner}>{children}</AndroidAppOfferContext.Provider>;
}

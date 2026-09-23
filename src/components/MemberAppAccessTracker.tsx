import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getMobilePlatform, isStandalonePwa } from '../lib/device';
import { classifyAppAccess } from '../lib/memberAppAccess';

export function MemberAppAccessTracker() {
  const { user, profile, loading } = useAuth();
  useEffect(() => {
    if (loading || !user || !profile?.org_id) return;
    const controller = new AbortController();
    const recorded = new Map<string, number>();
    let pending = false;
    const record = async () => {
      if (pending || controller.signal.aborted || document.visibilityState !== 'visible' || !navigator.onLine) return;
      const access = classifyAppAccess(Capacitor.getPlatform(), isStandalonePwa(), getMobilePlatform());
      const key = `${access.kind}:${access.platform}`;
      if (Date.now() - (recorded.get(key) ?? 0) < 5 * 60_000) return;
      pending = true;
      // Best-effort presence must never interrupt sign-in or depend on push consent.
      try {
        const { error } = await supabase.rpc('record_member_app_access', { p_app_kind: access.kind, p_platform: access.platform }).abortSignal(controller.signal);
        if (!error) recorded.set(key, Date.now());
      } catch { /* Retry on the next visible interval or connectivity event. */ }
      finally { pending = false; }
    };
    const refresh = () => { void record(); };
    refresh();
    const interval = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    const displayMode = window.matchMedia('(display-mode: standalone)');
    displayMode.addEventListener('change', refresh);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      displayMode.removeEventListener('change', refresh);
    };
  }, [user, profile?.org_id, loading]);
  return null;
}

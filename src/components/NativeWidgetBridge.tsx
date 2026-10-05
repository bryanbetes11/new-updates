import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { useAuth } from '../contexts/AuthContext';
import { deviceCacheScope } from '../lib/deviceCache';
import { nativeWidgets, publishWidgetSnapshot, supportsNativeWidgets } from '../lib/nativeWidgets';
import { validWidgetRoute } from '../lib/widgetSnapshot';
import { BADGE_COUNTS_REFRESH_EVENT } from '../lib/realtimeSignals';

// Mounted inside the authenticated layout so startup redirects cannot swallow
// a cold-start widget destination. AuthContext owns native cache revocation.
export function NativeWidgetBridge() {
  const { user, profile, organization, offlineMode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const userId = user?.id;
  const orgId = profile?.org_id;
  const churchName = organization?.name || 'Your church';
  useEffect(() => {
    if (!supportsNativeWidgets() || !userId || !orgId) return;
    const scope = deviceCacheScope(userId, orgId);
    if (!scope) return;
    let disposed = false;
    let running = false;
    let pendingRefresh = false;
    let controller: AbortController | undefined;
    const handles: PluginListenerHandle[] = [];
    const addHandle = (handle: PluginListenerHandle) => { if (disposed) void handle.remove(); else handles.push(handle); };
    const openTarget = async () => {
      const target = await nativeWidgets.consumeRoute();
      if (!disposed && target.scope === scope && validWidgetRoute(target.route)) navigate(target.route);
    };
    const refresh = async () => {
      if (disposed || offlineMode || document.visibilityState === 'hidden') return;
      if (running) { pendingRefresh = true; return; }
      running = true;
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 20000);
      try {
        const { count } = await nativeWidgets.status();
        if (count && !disposed) {
          const { loadWidgetSnapshot } = await import('../lib/loadWidgetSnapshot');
          const snapshot = await loadWidgetSnapshot(userId, orgId, scope, churchName, controller.signal);
          if (!disposed) await publishWidgetSnapshot(snapshot);
        }
      } catch { /* Keep the timestamped last snapshot on connection failure. */ }
      finally {
        window.clearTimeout(timeout);
        running = false;
        if (pendingRefresh && !disposed) { pendingRefresh = false; void refresh(); }
      }
    };
    const resume = () => { void openTarget().catch(() => {}); void refresh(); };
    void nativeWidgets.addListener('widgetOpen', resume).then(addHandle).catch(() => {});
    void App.addListener('appStateChange', state => { if (state.isActive) resume(); }).then(addHandle).catch(() => {});
    window.addEventListener(BADGE_COUNTS_REFRESH_EVENT, resume);
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    const interval = window.setInterval(() => { void refresh(); }, 60000);
    resume();
    return () => {
      disposed = true; controller?.abort(); window.clearInterval(interval);
      handles.forEach(handle => { void handle.remove(); });
      window.removeEventListener(BADGE_COUNTS_REFRESH_EVENT, resume);
      window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [userId, orgId, churchName, offlineMode, navigate, location.pathname]);
  return null;
}

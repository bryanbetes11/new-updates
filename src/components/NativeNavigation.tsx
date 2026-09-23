import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { App } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { isAndroidApp } from '../lib/nativeAppUpdates';
import { nativeBackHandlers } from '../lib/nativeBack';

export function NativeNavigation() {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  useEffect(() => {
    if (!isAndroidApp()) return;
    let disposed = false;
    let handle: PluginListenerHandle | undefined;
    void App.addListener('backButton', ({ canGoBack }) => {
      if (disposed || nativeBackHandlers.handle()) return;
      // Custom dialogs retain their existing Escape behavior. Never leave the
      // underlying page while an unregistered dialog still owns the screen.
      const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
      if (dialog) {
        (document.activeElement ?? dialog).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        return;
      }
      if (canGoBack && window.history.state?.idx > 0) navigateRef.current(-1);
      else void App.minimizeApp();
    }).then(listener => { if (disposed) void listener.remove(); else handle = listener; })
      .catch(() => { /* Retain Android's default handler if unavailable. */ });
    return () => { disposed = true; void handle?.remove(); };
  }, []);
  return null;
}

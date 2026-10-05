import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import type { WidgetSnapshot } from './widgetSnapshot';

interface WidgetPlugin {
  setScope(options: { scope: string | null }): Promise<void>;
  publish(options: { snapshot: WidgetSnapshot }): Promise<void>;
  status(): Promise<{ count: number }>;
  consumeRoute(): Promise<{ route?: string; scope?: string }>;
  addListener(event: 'widgetOpen', callback: () => void): Promise<PluginListenerHandle>;
}
export const nativeWidgets = registerPlugin<WidgetPlugin>('HomeWidgets');
export const supportsNativeWidgets = () => Capacitor.getPlatform() === 'android';

// Serialize scope changes and writes. A cleared account can never be repopulated
// by a request that finished after sign-out or an account switch.
let activeScope: string | null = null;
let scopeReady = false;
let queue: Promise<void> = Promise.resolve();
export function setWidgetScope(scope: string | null): Promise<void> {
  if (!supportsNativeWidgets()) return Promise.resolve();
  activeScope = scope;
  scopeReady = false;
  queue = queue.catch(() => {}).then(async () => {
    await nativeWidgets.setScope({ scope });
    if (activeScope === scope) scopeReady = true;
  });
  return queue;
}
export function publishWidgetSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  queue = queue.catch(() => {}).then(async () => {
    if (scopeReady && activeScope === snapshot.scope) await nativeWidgets.publish({ snapshot });
  });
  return queue;
}

import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from './supabase';
import { createNativePushController } from './nativePushController';
import { createNativePushOnboarding, type NativePushPromptState } from './nativePushOnboarding';

export const androidPushAvailable = () => Capacitor.getPlatform() === 'android'
  && import.meta.env.VITE_ANDROID_PUSH_ENABLED === 'true';
const installationKey = 'servesync:native-push-installation';
const ownerKey = 'servesync:native-push-owner';
const promptKey = (userId: string) => `servesync:native-push-prompt:${userId}`;
export const nativePushChanged = 'servesync:native-push-changed';
let registering = false;
const notificationSettings = registerPlugin<{ status: () => Promise<{ enabled: boolean }>; open: () => Promise<void> }>('NotificationSettings');

function installation() {
  const stored = localStorage.getItem(installationKey);
  if (stored) {
    const value = JSON.parse(stored) as { id: string; secret: string };
    if (typeof value.id !== 'string' || !/^[a-f0-9]{64}$/.test(value.secret)) throw new Error('Device registration needs to be reset.');
    return value;
  }
  const value = {
    id: crypto.randomUUID(),
    secret: Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join(''),
  };
  localStorage.setItem(installationKey, JSON.stringify(value));
  return value;
}

async function registerToken(): Promise<string> {
  registering = true;
  const handles: PluginListenerHandle[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let resolveToken!: (token: string) => void;
  let rejectToken!: (error: Error) => void;
  const pending = new Promise<string>((resolve, reject) => { resolveToken = resolve; rejectToken = reject; });
  try {
    handles.push(await PushNotifications.addListener('registration', token => resolveToken(token.value)));
    handles.push(await PushNotifications.addListener('registrationError', () => rejectToken(new Error('Android could not register notifications. Check your connection and try again.'))));
    timer = setTimeout(() => rejectToken(new Error('Notification registration timed out. Please try again.')), 15000);
    // Attach rejection handling before register can emit an immediate error.
    const result = Promise.all([pending, PushNotifications.register()]);
    return (await result)[0];
  } finally {
    registering = false;
    clearTimeout(timer);
    await Promise.all(handles.map(handle => handle.remove()));
  }
}

const controller = createNativePushController({
  owner: () => localStorage.getItem(ownerKey),
  saveOwner: userId => {
    if (userId) localStorage.setItem(ownerKey, userId);
    else localStorage.removeItem(ownerKey);
    window.dispatchEvent(new Event(nativePushChanged));
  },
  currentUser: async () => (await supabase.auth.getSession()).data.session?.user.id ?? null,
  permission: async ask => {
    let permission = await PushNotifications.checkPermissions();
    if (ask && permission.receive !== 'granted') permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted' || !(await notificationSettings.status()).enabled) return false;
    await PushNotifications.createChannel({ id: 'servesync_updates', name: 'ServeSync updates', importance: 4, visibility: 0, vibration: true });
    return true;
  },
  token: registerToken,
  claim: async token => {
    const device = installation();
    const { error } = await supabase.rpc('claim_native_push_device', {
      p_installation_id: device.id, p_secret: device.secret, p_token: token,
    }).abortSignal(AbortSignal.timeout(10000));
    if (error) throw new Error('Could not save this device for notifications. Please try again.');
  },
  revoke: async () => {
    if (!localStorage.getItem(installationKey)) return;
    const device = installation();
    const { error } = await supabase.rpc('revoke_native_push_device', {
      p_installation_id: device.id, p_secret: device.secret,
    }).abortSignal(AbortSignal.timeout(10000));
    if (error) throw new Error('Connect to the internet to disconnect this phone’s notifications, then try again.');
  },
  unregister: () => PushNotifications.unregister(),
  clearDelivered: () => PushNotifications.removeAllDeliveredNotifications(),
});

export async function nativePushEnabled(userId: string) {
  if (!androidPushAvailable() || localStorage.getItem(ownerKey) !== userId) return false;
  if ((await PushNotifications.checkPermissions()).receive !== 'granted') return false;
  if (!(await notificationSettings.status()).enabled) return false;
  const [device, preference] = await Promise.all([
    supabase.from('native_push_devices').select('enabled')
      .eq('installation_id', installation().id).eq('user_id', userId).maybeSingle(),
    supabase.from('notification_preferences').select('push_enabled').eq('user_id', userId).maybeSingle(),
  ]);
  if (device.error || preference.error) throw new Error('Could not check notification registration.');
  return device.data?.enabled === true && (preference.data?.push_enabled ?? true);
}
export const enableNativePush = async (userId: string) => {
  localStorage.setItem(promptKey(userId), 'done');
  const enabled = await controller.enable(userId);
  window.dispatchEvent(new Event(nativePushChanged));
  return enabled;
};
export const disableNativePush = async (userId: string) => {
  localStorage.setItem(promptKey(userId), 'done');
  await controller.disable();
};
const onboard = createNativePushOnboarding({
  owner: () => localStorage.getItem(ownerKey),
  hasInstallation: () => Boolean(localStorage.getItem(installationKey)),
  currentUser: async () => (await supabase.auth.getSession()).data.session?.user.id ?? null,
  state: userId => localStorage.getItem(promptKey(userId)) as NativePushPromptState | null,
  saveState: (userId, state) => localStorage.setItem(promptKey(userId), state),
  preferenceEnabled: async userId => {
    const { data, error } = await supabase.from('notification_preferences').select('push_enabled')
      .eq('user_id', userId).abortSignal(AbortSignal.timeout(10000)).maybeSingle();
    if (error) throw new Error('Could not check notification preferences.');
    return data?.push_enabled ?? true;
  },
  permission: async () => (await PushNotifications.checkPermissions()).receive,
  requestPermission: async () => (await PushNotifications.requestPermissions()).receive,
  enable: userId => controller.enable(userId, false),
});
export const onboardNativePush = (userId: string) => androidPushAvailable() ? onboard(userId) : Promise.resolve();
export async function nativePushReadiness(userId: string): Promise<boolean | null> {
  if (!androidPushAvailable()) return null;
  const permission = (await PushNotifications.checkPermissions()).receive;
  if (permission === 'denied' || permission === 'prompt-with-rationale') return false;
  if (permission === 'granted' && !(await notificationSettings.status()).enabled) return false;
  const { data, error } = await supabase.from('notification_preferences').select('push_enabled')
    .eq('user_id', userId).abortSignal(AbortSignal.timeout(10000)).maybeSingle();
  if (error) throw new Error('Could not check notification preferences.');
  if (data?.push_enabled === false) return false;
  if (!localStorage.getItem(ownerKey) && !localStorage.getItem(installationKey)
    && localStorage.getItem(promptKey(userId)) !== 'done') return null;
  return nativePushEnabled(userId);
}
export async function openNativePushSettingsIfBlocked() {
  if (!androidPushAvailable()) return false;
  const permission = (await PushNotifications.checkPermissions()).receive;
  if (permission === 'denied' || (permission === 'granted' && !(await notificationSettings.status()).enabled)) {
    const userId = (await supabase.auth.getSession()).data.session?.user.id;
    if (userId) localStorage.setItem(promptKey(userId), 'pending');
    await notificationSettings.open();
    return true;
  }
  return false;
}
export const refreshNativePushToken = (token: string) => registering ? Promise.resolve() : controller.refreshToken(token);
export const reconcileNativePush = (userId: string | null) => androidPushAvailable() ? controller.reconcile(userId) : Promise.resolve(false);
export const disconnectNativePush = () => androidPushAvailable() && localStorage.getItem(ownerKey)
  ? controller.disable() : Promise.resolve();

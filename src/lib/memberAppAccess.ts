export type AppKind = 'android_app' | 'ios_app' | 'pwa' | 'browser';
export type AccessPlatform = 'android' | 'ios' | 'other';
export interface MemberAppAccess {
  user_id: string;
  app_kind: AppKind;
  platform: AccessPlatform;
  last_seen_at: string;
}

export function classifyAppAccess(nativePlatform: string, standalone: boolean, platform: AccessPlatform): { kind: AppKind; platform: AccessPlatform } {
  if (nativePlatform === 'android') return { kind: 'android_app', platform: 'android' };
  if (nativePlatform === 'ios') return { kind: 'ios_app', platform: 'ios' };
  return { kind: standalone ? 'pwa' : 'browser', platform };
}

export const appKindLabels: Record<AppKind, string> = {
  android_app: 'Android app (APK)', ios_app: 'iOS app', pwa: 'Installed PWA', browser: 'Browser observed',
};
export const accessPlatformLabels: Record<AccessPlatform, string> = { android: 'Android', ios: 'iOS', other: 'Other device' };

export function appAccessKinds(rows: MemberAppAccess[]): AppKind[] {
  return (Object.keys(appKindLabels) as AppKind[]).filter(kind => rows.some(row => row.app_kind === kind));
}

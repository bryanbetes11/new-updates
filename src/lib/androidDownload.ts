export const ANDROID_TEST_RELEASE = {
  version: '1.4.0',
  build: 19,
  filename: 'ServeSync-1.4.0.apk',
  url: 'https://github.com/bryanbetes11/new-updates/releases/download/android-v1.4.0-build19/ServeSync-1.4.0.apk',
};

export function shouldOfferAndroidApp(options: { android: boolean; standalone: boolean; native: boolean; signedIn: boolean; dashboard: boolean; dismissed: boolean }) {
  return options.android && options.standalone && !options.native && options.signedIn && options.dashboard && !options.dismissed;
}

export const APK_OFFER_INTERVAL = 24 * 60 * 60 * 1000;
export function isAndroidOfferDue(lastShown: number | null, now: number, hasUsedAndroid: boolean) {
  if (hasUsedAndroid) return false;
  return lastShown === null || !Number.isFinite(lastShown) || now - lastShown >= APK_OFFER_INTERVAL;
}

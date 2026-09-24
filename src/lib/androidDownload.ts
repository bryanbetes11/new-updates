export const ANDROID_TEST_RELEASE = {
  version: '1.4.5',
  build: 24,
  filename: 'ServeSync-1.4.5.apk',
  url: 'https://github.com/bryanbetes11/new-updates/releases/download/android-v1.4.5-build24/ServeSync-1.4.5.apk',
};

export function shouldOfferAndroidApp(options: { android: boolean; standalone: boolean; native: boolean; signedIn: boolean; dashboard: boolean }) {
  return options.android && options.standalone && !options.native && options.signedIn && options.dashboard;
}

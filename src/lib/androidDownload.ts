export const ANDROID_TEST_RELEASE = {
  version: '1.4.15',
  build: 36,
  filename: 'ServeSync-1.4.15.apk',
  url: 'https://github.com/bryanbetes11/new-updates/releases/download/android-v1.4.15-build36/ServeSync-1.4.15.apk',
};

export function shouldOfferAndroidApp(options: { android: boolean; standalone: boolean; native: boolean; signedIn: boolean; dashboard: boolean }) {
  return options.android && options.standalone && !options.native && options.signedIn && options.dashboard;
}

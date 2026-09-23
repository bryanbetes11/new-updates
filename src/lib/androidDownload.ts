export const ANDROID_TEST_RELEASE = {
  version: '1.3.0',
  build: 5,
  filename: 'ServeSync-1.3.0-android-test-build5.apk',
  url: 'https://github.com/bryanbetes11/new-updates/releases/download/android-test-v1.3.0-build5/ServeSync-1.3.0-android-test-build5.apk',
};

export function shouldOfferAndroidApp(options: { android: boolean; standalone: boolean; native: boolean; signedIn: boolean; dashboard: boolean; dismissed: boolean }) {
  return options.android && options.standalone && !options.native && options.signedIn && options.dashboard && !options.dismissed;
}

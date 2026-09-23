export const ANDROID_TEST_RELEASE = {
  version: '1.4.3',
  build: 22,
  filename: 'ServeSync-1.4.3.apk',
  url: 'https://github.com/bryanbetes11/new-updates/releases/download/android-v1.4.3-build22/ServeSync-1.4.3.apk',
};

export function shouldOfferAndroidApp(options: { android: boolean; standalone: boolean; native: boolean; signedIn: boolean; dashboard: boolean }) {
  return options.android && options.standalone && !options.native && options.signedIn && options.dashboard;
}

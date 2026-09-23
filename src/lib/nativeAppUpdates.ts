import { App } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { ANDROID_RELEASES_API, createAndroidUpdateChecker, isTrustedAndroidDownload } from './androidRelease';

export const isAndroidApp = () => Capacitor.getPlatform() === 'android';
const nativeUpdates = registerPlugin<{ openDownload(options: { url: string }): Promise<void> }>('NativeAppUpdates');

export const androidUpdates = createAndroidUpdateChecker({
  installed: () => App.getInfo(),
  releases: async () => {
    const response = await fetch(ANDROID_RELEASES_API, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store', signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error('Release check unavailable.');
    return response.json();
  },
  now: () => Date.now(),
});

export async function downloadAndroidUpdate() {
  // Recheck before opening so a withdrawn or replaced release is not offered.
  const result = await androidUpdates.check(true);
  if (result.status !== 'available' || !result.release || !isTrustedAndroidDownload(result.release.url)) {
    throw new Error(result.status === 'up-to-date'
      ? 'No newer Android update is currently available.'
      : 'Could not verify this update. Check your connection and try again.');
  }
  await nativeUpdates.openDownload({ url: result.release.url });
}

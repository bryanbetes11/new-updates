import { App } from '@capacitor/app';
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { ANDROID_RELEASES_API, createAndroidUpdateChecker, isTrustedAndroidDownload, type AndroidRelease } from './androidRelease';

export const isAndroidApp = () => Capacitor.getPlatform() === 'android';
type UpdateProgress = { build: number; downloaded: number; total: number; percent: number };
type InstallAction = { action: 'installer' | 'settings' };
const nativeUpdates = registerPlugin<{
  openDownload(options: { url: string }): Promise<void>;
  downloadUpdate(options: { url: string; build: number; size: number; sha256: string }): Promise<void>;
  getDownloadedUpdate(options: { build: number; sha256: string }): Promise<{ ready: boolean }>;
  installUpdate(options: { build: number; sha256: string }): Promise<InstallAction>;
  addListener(eventName: 'downloadProgress', listener: (progress: UpdateProgress) => void): Promise<PluginListenerHandle>;
}>('NativeAppUpdates');

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

function verifiedOptions(release: AndroidRelease) {
  if (!isTrustedAndroidDownload(release.url) || !release.sha256) {
    throw new Error('Could not verify this update package. Try again later.');
  }
  return { url: release.url, build: release.build, size: release.size, sha256: release.sha256 };
}

export function subscribeAndroidUpdateProgress(listener: (progress: UpdateProgress) => void) {
  return nativeUpdates.addListener('downloadProgress', listener);
}

export async function isAndroidUpdateDownloaded(release: AndroidRelease) {
  const { build, sha256 } = verifiedOptions(release);
  return (await nativeUpdates.getDownloadedUpdate({ build, sha256 })).ready;
}

export async function downloadAndroidUpdate(expectedBuild: number): Promise<'browser' | 'downloaded'> {
  // Recheck before downloading so a withdrawn or replaced release is not offered.
  const result = await androidUpdates.check(true);
  if (result.status !== 'available' || !result.release || !isTrustedAndroidDownload(result.release.url)) {
    throw new Error(result.status === 'up-to-date'
      ? 'No newer Android update is currently available.'
      : 'Could not verify this update. Check your connection and try again.');
  }
  if (result.release.build !== expectedBuild) throw new Error('A newer update is available. Tap Download update again.');
  // Installed builds through 14 do not contain the native in-app downloader.
  if ((result.installedBuild ?? 0) < 15) {
    await nativeUpdates.openDownload({ url: result.release.url });
    return 'browser';
  }
  await nativeUpdates.downloadUpdate(verifiedOptions(result.release));
  return 'downloaded';
}

export async function installAndroidUpdate(release: AndroidRelease): Promise<InstallAction> {
  const { build, sha256 } = verifiedOptions(release);
  return nativeUpdates.installUpdate({ build, sha256 });
}

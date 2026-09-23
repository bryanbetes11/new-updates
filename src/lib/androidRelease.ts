export interface AndroidRelease {
  version: string;
  build: number;
  url: string;
  size: number;
}

export const ANDROID_RELEASES_API = 'https://api.github.com/repos/bryanbetes11/new-updates/releases?per_page=100';
const downloadRoot = 'https://github.com/bryanbetes11/new-updates/releases/download/';

export function isTrustedAndroidDownload(url: string) {
  const match = /^https:\/\/github\.com\/bryanbetes11\/new-updates\/releases\/download\/android-(?:test-)?v(\d+\.\d+\.\d+)-build([1-9]\d*)\/ServeSync-(\d+\.\d+\.\d+)(?:-android-(?:test|release)-build([1-9]\d*))?\.apk$/.exec(url);
  return !!match && match[1] === match[3] && (!match[4] || match[2] === match[4]);
}

export function newestAndroidRelease(data: unknown, installedBuild: number): AndroidRelease | null {
  if (!Array.isArray(data) || !Number.isSafeInteger(installedBuild) || installedBuild < 1) {
    throw new Error('Could not verify Android release information.');
  }
  let newest: AndroidRelease | null = null;
  for (const item of data) {
    if (!item || typeof item !== 'object' || item.draft !== false || !item.published_at) continue;
    const match = typeof item.tag_name === 'string'
      ? /^android-(?:test-)?v(\d+\.\d+\.\d+)-build([1-9]\d*)$/.exec(item.tag_name) : null;
    if (!match || !Array.isArray(item.assets)) continue;
    const [, version, rawBuild] = match;
    const build = Number(rawBuild);
    if (!Number.isSafeInteger(build) || build <= installedBuild || build <= (newest?.build ?? 0)) continue;
    const asset = item.assets.find((entry: Record<string, unknown>) => {
      if (!entry || typeof entry !== 'object') return false;
      const name = entry.name;
      return (name === `ServeSync-${version}.apk`
        || name === `ServeSync-${version}-android-test-build${build}.apk`
        || name === `ServeSync-${version}-android-release-build${build}.apk`)
        && entry.state === 'uploaded' && typeof entry.size === 'number' && entry.size > 0
        && entry.browser_download_url === `${downloadRoot}${item.tag_name}/${name}`;
    });
    if (asset && isTrustedAndroidDownload(asset.browser_download_url)) {
      newest = { version, build, url: asset.browser_download_url, size: asset.size };
    }
  }
  return newest;
}

export interface AndroidUpdateSnapshot {
  status: 'idle' | 'checking' | 'available' | 'up-to-date' | 'error';
  release: AndroidRelease | null;
  installedVersion?: string;
  installedBuild?: number;
}

export function createAndroidUpdateChecker(deps: {
  installed: () => Promise<{ version: string; build: string }>;
  releases: () => Promise<unknown>;
  now: () => number;
}) {
  let snapshot: AndroidUpdateSnapshot = { status: 'idle', release: null };
  let nextCheckAt = 0;
  let pending: Promise<AndroidUpdateSnapshot> | null = null;
  const listeners = new Set<() => void>();
  function publish(next: AndroidUpdateSnapshot) {
    snapshot = next;
    listeners.forEach(listener => listener());
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    check(force = false): Promise<AndroidUpdateSnapshot> {
      if (pending) return pending;
      if (!force && deps.now() < nextCheckAt) return Promise.resolve(snapshot);
      publish({ ...snapshot, status: 'checking' });
      pending = (async () => {
        try {
          const [installed, releases] = await Promise.all([deps.installed(), deps.releases()]);
          const installedBuild = /^\d+$/.test(installed.build) ? Number(installed.build) : NaN;
          const release = newestAndroidRelease(releases, installedBuild);
          nextCheckAt = deps.now() + 6 * 60 * 60 * 1000;
          publish({ status: release ? 'available' : 'up-to-date', release, installedBuild, installedVersion: installed.version });
        } catch {
          nextCheckAt = deps.now() + 60 * 1000;
          publish({ ...snapshot, status: 'error' });
        } finally { pending = null; }
        return snapshot;
      })();
      return pending;
    },
  };
}

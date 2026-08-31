import {
  APP_BUILD_ID,
  APP_BUILD_NUMBER,
  APP_CACHE_VERSION,
  APP_MINIMUM_SUPPORTED_VERSION,
  APP_UPDATE_PUBLISHED_AT,
  APP_RELEASE_HEADLINE,
  APP_RELEASE_HIGHLIGHTS,
  APP_VERSION,
  isAppVersionBelow,
} from './appUpdate';

export const APP_UPDATE_AVAILABLE_EVENT = 'servesync:app-update-available';

const INSTALLED_APP_VERSION_KEY = 'servesync-installed-app-version';
const LATEST_WORKER_READY_TIMEOUT_MS = 20_000;

export interface AppVersionManifest {
  version: string;
  buildId: string;
  buildNumber: number;
  cacheVersion: string;
  publishedAt: string;
  minimumSupportedVersion: string;
  releaseHeadline: string;
  releaseHighlights: string[];
}

export interface PendingAppUpdate extends AppVersionManifest {
  required: boolean;
}

export type AppUpdateCheckResult =
  | { status: 'up-to-date'; manifest: AppVersionManifest }
  | { status: 'available'; manifest: PendingAppUpdate }
  | { status: 'unavailable'; error: Error };

const currentManifest: AppVersionManifest = {
  version: APP_VERSION,
  buildId: APP_BUILD_ID,
  buildNumber: APP_BUILD_NUMBER,
  cacheVersion: APP_CACHE_VERSION,
  publishedAt: APP_UPDATE_PUBLISHED_AT,
  minimumSupportedVersion: APP_MINIMUM_SUPPORTED_VERSION,
  releaseHeadline: APP_RELEASE_HEADLINE,
  releaseHighlights: APP_RELEASE_HIGHLIGHTS,
};

let pendingRegistration: ServiceWorkerRegistration | null = null;
let pendingUpdate: PendingAppUpdate | null = null;
let installedAppVersion = readStoredInstalledAppVersion();
let userRequestedUpdate = false;
let hasRegisteredControllerChangeHandler = false;
let activeUpdateCheck: Promise<AppUpdateCheckResult> | null = null;

function getLocalStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isLocalPreviewHost() {
  if (typeof window === 'undefined') return false;
  const { hostname } = window.location;

  return ['localhost', '127.0.0.1', '::1'].includes(hostname)
    || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)
    || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)
    || /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname);
}

function readStoredInstalledAppVersion() {
  const storage = getLocalStorage();
  if (!storage) return null;
  try {
    return storage.getItem(INSTALLED_APP_VERSION_KEY);
  } catch {
    return null;
  }
}

function persistInstalledAppVersion(version: string | null) {
  installedAppVersion = version;
  const storage = getLocalStorage();
  if (!storage) return;

  try {
    if (version) storage.setItem(INSTALLED_APP_VERSION_KEY, version);
    else storage.removeItem(INSTALLED_APP_VERSION_KEY);
  } catch {
    // Update tracking is optional and should never block rendering.
  }
}

function getVersionFromScriptUrl(scriptUrl?: string | null) {
  if (!scriptUrl) return null;
  try {
    const url = new URL(scriptUrl, window.location.origin);
    return url.searchParams.get('appVersion') || url.searchParams.get('v');
  } catch {
    return null;
  }
}

export function getServiceWorkerCacheVersion(scriptUrl?: string | null, baseUrl?: string) {
  if (!scriptUrl) return null;
  try {
    const fallbackBaseUrl = baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://servesync.invalid');
    return new URL(scriptUrl, fallbackBaseUrl).searchParams.get('v');
  } catch {
    return null;
  }
}

export function serviceWorkerScriptMatchesCacheVersion(
  scriptUrl: string | null | undefined,
  cacheVersion: string,
  baseUrl?: string,
) {
  return getServiceWorkerCacheVersion(scriptUrl, baseUrl) === cacheVersion;
}

function workerMatchesUpdate(
  worker: ServiceWorker | null | undefined,
  update: AppVersionManifest | null | undefined,
) {
  return Boolean(
    worker
    && update
    && serviceWorkerScriptMatchesCacheVersion(worker.scriptURL, update.cacheVersion),
  );
}

function serviceWorkerUrl(manifest: AppVersionManifest) {
  return `/sw.js?v=${encodeURIComponent(manifest.cacheVersion)}&appVersion=${encodeURIComponent(manifest.version)}`;
}

function normalizeManifest(value: unknown): AppVersionManifest | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<AppVersionManifest>;
  if (
    typeof candidate.version !== 'string'
    || typeof candidate.buildId !== 'string'
    || typeof candidate.buildNumber !== 'number'
    || typeof candidate.cacheVersion !== 'string'
    || typeof candidate.publishedAt !== 'string'
  ) return null;

  return {
    version: candidate.version,
    buildId: candidate.buildId,
    buildNumber: candidate.buildNumber,
    cacheVersion: candidate.cacheVersion,
    publishedAt: candidate.publishedAt,
    minimumSupportedVersion: typeof candidate.minimumSupportedVersion === 'string'
      ? candidate.minimumSupportedVersion
      : '0.0.0',
    releaseHeadline: typeof candidate.releaseHeadline === 'string'
      ? candidate.releaseHeadline
      : 'A new ServeSync build is ready.',
    releaseHighlights: Array.isArray(candidate.releaseHighlights)
      ? candidate.releaseHighlights.filter((item): item is string => typeof item === 'string').slice(0, 6)
      : [],
  };
}

function toPendingUpdate(manifest: AppVersionManifest): PendingAppUpdate {
  return {
    ...manifest,
    required: isAppVersionBelow(APP_VERSION, manifest.minimumSupportedVersion),
  };
}

function emitUpdateAvailable(update: PendingAppUpdate) {
  window.dispatchEvent(new CustomEvent(APP_UPDATE_AVAILABLE_EVENT, {
    detail: { ...update, installedVersion: installedAppVersion || APP_VERSION },
  }));
}

function syncInstalledVersion(registration: ServiceWorkerRegistration) {
  const activeVersion = getVersionFromScriptUrl(registration.active?.scriptURL);
  if (activeVersion) {
    persistInstalledAppVersion(activeVersion);
    return activeVersion;
  }
  return installedAppVersion;
}

function markWaitingWorker(registration: ServiceWorkerRegistration, update: PendingAppUpdate) {
  if (!workerMatchesUpdate(registration.waiting, update)) return false;
  pendingRegistration = registration;
  pendingUpdate = update;
  syncInstalledVersion(registration);
  emitUpdateAvailable(update);
  return true;
}

function watchInstallingWorker(registration: ServiceWorkerRegistration, update: PendingAppUpdate) {
  const worker = registration.installing;
  if (!worker || !workerMatchesUpdate(worker, update)) return;

  worker.addEventListener('statechange', () => {
    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
      markWaitingWorker(registration, update);
    }
  });
}

function attachRegistrationListeners(registration: ServiceWorkerRegistration, update: PendingAppUpdate) {
  syncInstalledVersion(registration);
  markWaitingWorker(registration, update);
  watchInstallingWorker(registration, update);
  registration.addEventListener('updatefound', () => watchInstallingWorker(registration, update));
}

function waitForMatchingWaitingWorker(
  registration: ServiceWorkerRegistration,
  update: PendingAppUpdate,
) {
  if (markWaitingWorker(registration, update)) return Promise.resolve(true);

  return new Promise<boolean>(resolve => {
    let settled = false;
    const watchedWorkers = new WeakSet<ServiceWorker>();

    const finish = (ready: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      registration.removeEventListener('updatefound', handleUpdateFound);
      resolve(ready);
    };

    const checkRegistration = () => {
      if (markWaitingWorker(registration, update)) {
        finish(true);
        return;
      }

      const worker = registration.installing;
      if (!worker || !workerMatchesUpdate(worker, update) || watchedWorkers.has(worker)) return;
      watchedWorkers.add(worker);
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed') checkRegistration();
        if (worker.state === 'redundant') checkRegistration();
      });
    };

    const handleUpdateFound = () => checkRegistration();
    const timeout = window.setTimeout(() => finish(false), LATEST_WORKER_READY_TIMEOUT_MS);
    registration.addEventListener('updatefound', handleUpdateFound);
    checkRegistration();
  });
}

export function getInstalledAppVersion() {
  return installedAppVersion || APP_VERSION;
}

export function getPendingAppUpdate() {
  return pendingUpdate;
}

export function hasPendingAppUpdate() {
  return workerMatchesUpdate(pendingRegistration?.waiting, pendingUpdate);
}

export function shouldRequireAppUpdate() {
  return Boolean(pendingUpdate?.required);
}

async function performAppUpdateCheck(): Promise<AppUpdateCheckResult> {
  if (import.meta.env.DEV || isLocalPreviewHost() || !('serviceWorker' in navigator)) {
    return { status: 'up-to-date', manifest: currentManifest };
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Version check failed with status ${response.status}`);

    const manifest = normalizeManifest(await response.json());
    if (!manifest) throw new Error('Version manifest is invalid');
    if (manifest.cacheVersion === APP_CACHE_VERSION) {
      return { status: 'up-to-date', manifest };
    }

    const update = toPendingUpdate(manifest);
    const registration = await navigator.serviceWorker.register(serviceWorkerUrl(manifest));
    pendingRegistration = registration;
    pendingUpdate = update;
    attachRegistrationListeners(registration, update);

    try {
      await registration.update();
    } catch (error) {
      console.warn('Could not download the latest ServeSync app shell:', error);
    }

    // The newest worker may already be active if another tab completed the
    // update first. In that case this page only needs one reload; it must not
    // fall back to activating an older waiting worker.
    if (
      workerMatchesUpdate(navigator.serviceWorker.controller, update)
      || workerMatchesUpdate(registration.active, update)
    ) {
      return { status: 'available', manifest: update };
    }

    const latestWorkerReady = await waitForMatchingWaitingWorker(registration, update);
    if (!latestWorkerReady) {
      throw new Error('The latest ServeSync worker did not finish installing in time');
    }
    return { status: 'available', manifest: update };
  } catch (error) {
    const normalizedError = error instanceof Error ? error : new Error('Version check failed');
    console.warn('Could not check for the latest ServeSync version:', normalizedError);
    return { status: 'unavailable', error: normalizedError };
  } finally {
    window.clearTimeout(timeout);
  }
}

export function checkForAppUpdate(): Promise<AppUpdateCheckResult> {
  if (activeUpdateCheck) return activeUpdateCheck;
  activeUpdateCheck = performAppUpdateCheck().finally(() => {
    activeUpdateCheck = null;
  });
  return activeUpdateCheck;
}

export async function applyPendingAppUpdate() {
  const latestCheck = await checkForAppUpdate();

  if (latestCheck.status === 'unavailable') {
    console.warn('The latest ServeSync version could not be verified. No older update was applied.');
    userRequestedUpdate = false;
    return false;
  }

  if (latestCheck.status === 'up-to-date') {
    persistInstalledAppVersion(latestCheck.manifest.version);
    window.location.reload();
    return true;
  }

  const update = latestCheck.manifest;
  const registration = pendingRegistration || await navigator.serviceWorker.getRegistration();

  // If the exact newest worker is already active, a reload is sufficient to
  // move this page directly onto it.
  if (
    workerMatchesUpdate(navigator.serviceWorker.controller, update)
    || workerMatchesUpdate(registration?.active, update)
  ) {
    persistInstalledAppVersion(update.version);
    window.location.reload();
    return true;
  }

  const waitingWorker = registration?.waiting;

  if (!registration || !update || !waitingWorker || !workerMatchesUpdate(waitingWorker, update)) {
    console.warn('The latest ServeSync update is not ready yet. The updater will try again shortly.');
    userRequestedUpdate = false;
    return false;
  }

  userRequestedUpdate = true;
  waitingWorker.postMessage({ type: 'SKIP_WAITING' });

  window.setTimeout(() => {
    if (!userRequestedUpdate) return;
    if (workerMatchesUpdate(navigator.serviceWorker.controller, update)) {
      persistInstalledAppVersion(update.version);
      window.location.reload();
      return;
    }

    userRequestedUpdate = false;
    void checkForAppUpdate();
  }, 10_000);
  return true;
}

export function registerAppServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV || isLocalPreviewHost()) {
    window.addEventListener('load', async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations
            .filter(registration => registration.scope.startsWith(window.location.origin))
            .map(registration => registration.unregister()),
        );

        if ('caches' in window) {
          const cacheKeys = await window.caches.keys();
          await Promise.all(cacheKeys.map(cacheKey => window.caches.delete(cacheKey)));
        }
      } catch (error) {
        console.warn('Failed to clean up local preview service workers:', error);
      }
    });
    return;
  }

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(serviceWorkerUrl(currentManifest));
      // Do not treat a previously waiting worker as the current release. The
      // manifest check below identifies and prepares the actual latest worker.
      syncInstalledVersion(registration);

      if (!hasRegisteredControllerChangeHandler) {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!userRequestedUpdate) return;
          if (!workerMatchesUpdate(navigator.serviceWorker.controller, pendingUpdate)) return;
          persistInstalledAppVersion(pendingUpdate?.version || APP_VERSION);
          userRequestedUpdate = false;
          window.location.reload();
        });
        hasRegisteredControllerChangeHandler = true;
      }

      void checkForAppUpdate();
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  });
}

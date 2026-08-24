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
      ? candidate.releaseHighlights.filter((item): item is string => typeof item === 'string').slice(0, 3)
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
  pendingRegistration = registration;
  pendingUpdate = update;
  syncInstalledVersion(registration);
  emitUpdateAvailable(update);
}

function watchInstallingWorker(registration: ServiceWorkerRegistration, update: PendingAppUpdate) {
  const worker = registration.installing;
  if (!worker) return;

  worker.addEventListener('statechange', () => {
    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
      markWaitingWorker(registration, update);
    }
  });
}

function attachRegistrationListeners(registration: ServiceWorkerRegistration, update: PendingAppUpdate) {
  syncInstalledVersion(registration);
  if (registration.waiting) markWaitingWorker(registration, update);
  watchInstallingWorker(registration, update);
  registration.addEventListener('updatefound', () => watchInstallingWorker(registration, update));
}

export function getInstalledAppVersion() {
  return installedAppVersion || APP_VERSION;
}

export function getPendingAppUpdate() {
  return pendingUpdate;
}

export function hasPendingAppUpdate() {
  return Boolean(pendingRegistration?.waiting);
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

    if (registration.waiting) markWaitingWorker(registration, update);
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
  userRequestedUpdate = true;
  const registration = pendingRegistration || await navigator.serviceWorker.getRegistration();
  if (registration?.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    window.setTimeout(() => window.location.reload(), 4000);
    return;
  }
  window.location.reload();
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
      attachRegistrationListeners(registration, toPendingUpdate(currentManifest));

      if (!hasRegisteredControllerChangeHandler) {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!userRequestedUpdate) return;
          persistInstalledAppVersion(pendingUpdate?.version || APP_VERSION);
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

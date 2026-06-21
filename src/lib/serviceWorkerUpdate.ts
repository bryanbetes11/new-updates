import { APP_UPDATE_VERSION } from './appUpdate';

export const APP_UPDATE_AVAILABLE_EVENT = 'servesync:app-update-available';

const INSTALLED_APP_VERSION_KEY = 'servesync-installed-app-version';

let pendingRegistration: ServiceWorkerRegistration | null = null;
let installedAppVersion = readStoredInstalledAppVersion();
let userRequestedUpdate = false;
let hasRegisteredControllerChangeHandler = false;

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
  const { hostname, port } = window.location;

  return ['localhost', '127.0.0.1', '::1'].includes(hostname)
    || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)
    || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)
    || /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
    || ['4173', '5173'].includes(port);
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
    if (version) {
      storage.setItem(INSTALLED_APP_VERSION_KEY, version);
      return;
    }

    storage.removeItem(INSTALLED_APP_VERSION_KEY);
  } catch {
    // App update tracking is optional; never block rendering on storage.
  }
}

function getVersionFromScriptUrl(scriptUrl?: string | null) {
  if (!scriptUrl) return null;

  try {
    const url = new URL(scriptUrl, window.location.origin);
    return url.searchParams.get('v');
  } catch {
    return null;
  }
}

function emitUpdateAvailable() {
  window.dispatchEvent(new CustomEvent(APP_UPDATE_AVAILABLE_EVENT, {
    detail: {
      version: APP_UPDATE_VERSION,
      installedVersion: installedAppVersion,
      updateRequired: installedAppVersion !== APP_UPDATE_VERSION,
    },
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

function markWaitingWorker(registration: ServiceWorkerRegistration) {
  pendingRegistration = registration;
  syncInstalledVersion(registration);
  emitUpdateAvailable();
}

export function getInstalledAppVersion() {
  return installedAppVersion;
}

export function hasPendingAppUpdate() {
  return Boolean(pendingRegistration?.waiting);
}

export function shouldRequireAppUpdate() {
  return hasPendingAppUpdate();
}

export function applyPendingAppUpdate() {
  userRequestedUpdate = true;
  if (pendingRegistration?.waiting) {
    pendingRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
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
      const registration = await navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(APP_UPDATE_VERSION)}`);
      console.log('Service Worker registered:', registration.scope);

      syncInstalledVersion(registration);

      if (registration.waiting) {
        markWaitingWorker(registration);
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            markWaitingWorker(registration);
          }
        });
      });

      if (!hasRegisteredControllerChangeHandler) {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (userRequestedUpdate) {
            persistInstalledAppVersion(APP_UPDATE_VERSION);
            window.location.reload();
          }
        });
        hasRegisteredControllerChangeHandler = true;
      }

    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  });
}

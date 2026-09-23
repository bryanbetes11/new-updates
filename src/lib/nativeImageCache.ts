import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';

interface NativeImageCacheBridge {
  setScope(options: { scope: string | null }): Promise<void>;
  clear(options: { scope: string }): Promise<void>;
  getImage(options: { scope: string; url: string }): Promise<{ uri: string }>;
}

const nativeImageCache = registerPlugin<NativeImageCacheBridge>('NativeImageCache');
const isAndroid = () => Capacitor.getPlatform() === 'android';
const listeners = new Set<() => void>();
const pendingImages = new Map<string, Promise<string>>();
let generation = 0;
let readyScope: string | null = null;
let remoteOnlyScope: string | null = null;
let scopeRequestInFlight = false;
let scopeInitialized = false;
let scopeIntent = 0;

function notifyScopeChange() {
  generation++;
  pendingImages.clear();
  listeners.forEach((listener) => listener());
}

function resolveCachedImage(scope: string, url: string): Promise<string> {
  const key = `${scope}\n${url}`;
  const existing = pendingImages.get(key);
  if (existing) return existing;
  const request = nativeImageCache.getImage({ scope, url }).then(({ uri }) => Capacitor.convertFileSrc(uri));
  pendingImages.set(key, request);
  const remove = () => { if (pendingImages.get(key) === request) pendingImages.delete(key); };
  void request.then(remove, remove);
  return request;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getGeneration() {
  return generation;
}

export function useNativeImageCacheScope(): string | null {
  useSyncExternalStore(subscribe, getGeneration, getGeneration);
  return readyScope || remoteOnlyScope;
}

export async function setNativeImageCacheScope(scope: string | null): Promise<void> {
  if (!isAndroid()) return;
  if (scope === readyScope && !scopeRequestInFlight && scopeInitialized) return;
  scopeIntent++;
  // Revoke old file URLs immediately; the native side also rejects old work.
  readyScope = null;
  remoteOnlyScope = null;
  notifyScopeChange();
  scopeRequestInFlight = true;
  const requestGeneration = generation;
  try {
    await nativeImageCache.setScope({ scope });
    if (requestGeneration === generation) {
      scopeRequestInFlight = false;
      scopeInitialized = true;
      readyScope = scope;
      notifyScopeChange();
    }
  } catch (error) {
    // Keep local files inaccessible when native scope activation fails.
    if (requestGeneration === generation) {
      scopeRequestInFlight = false;
      scopeInitialized = true;
      remoteOnlyScope = scope;
      notifyScopeChange();
    }
    throw error;
  }
}

export async function clearNativeImageCache(): Promise<void> {
  const scope = readyScope || remoteOnlyScope;
  if (!scope || !isAndroid()) return;
  scopeIntent++;
  readyScope = null;
  remoteOnlyScope = null;
  notifyScopeChange();
  const clearingIntent = scopeIntent;
  try {
    await nativeImageCache.clear({ scope });
  } catch (error) {
    if (scope && scopeIntent === clearingIntent) {
      remoteOnlyScope = scope;
      notifyScopeChange();
    }
    throw error;
  }
  if (scopeIntent === clearingIntent) {
    readyScope = scope;
    notifyScopeChange();
  }
}

export function useNativeCachedImage(url?: string | null, options: { lazy?: boolean } = {}) {
  const lazy = options.lazy === true;
  const currentGeneration = useSyncExternalStore(subscribe, getGeneration, getGeneration);
  const scope = readyScope;
  const remoteScope = remoteOnlyScope;
  const [resolved, setResolved] = useState<{ key: string; src: string | null } | null>(null);
  const [observeElement, setObserveElement] = useState<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  const observeRef = useCallback((element: HTMLElement | null) => setObserveElement(element), []);
  const key = `${currentGeneration}\n${url || ''}`;
  const isNative = isAndroid();

  useEffect(() => {
    if (!isNative || !lazy || !observeElement || visible) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setVisible(true);
    }, { rootMargin: '300px' });
    observer.observe(observeElement);
    return () => observer.disconnect();
  }, [isNative, lazy, observeElement, visible]);

  useEffect(() => {
    if (!isNative || !scope || remoteScope || !url || (lazy && !visible)) return undefined;
    let cancelled = false;
    if (!url.startsWith('https://')) {
      setResolved({ key, src: url });
      return undefined;
    }
    resolveCachedImage(scope, url).then((cachedUrl) => {
      if (!cancelled && generation === currentGeneration) {
        setResolved({ key, src: cachedUrl });
      }
    }).catch(() => {
      if (!cancelled && generation === currentGeneration) setResolved({ key, src: url });
    });
    return () => { cancelled = true; };
  }, [currentGeneration, isNative, key, lazy, remoteScope, scope, url, visible]);

  const src = !isNative || remoteScope || !scope ? url || null : resolved?.key === key ? resolved.src : null;
  const retryRemoteOnError = () => {
    if (!isNative || !scope || !url || !src || src === url) return false;
    setResolved({ key, src: url });
    return true;
  };
  return { src, observeRef, retryRemoteOnError };
}

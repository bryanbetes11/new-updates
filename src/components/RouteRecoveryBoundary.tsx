import { Component, type ErrorInfo, type ReactNode } from 'react';

const RECOVERY_MARKER_KEY = 'servesync:route-recovery-refresh';
const RECOVERY_LOG_KEY = 'servesync:route-load-errors';
const RECOVERY_WINDOW_MS = 30_000;

type RecoveryMarker = { path: string; at: number };
type RouteRecoveryState = { error: Error | null; failedAsset: string | null };

function getSessionStorage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function errorText(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error || 'Unknown route loading error');
}

export function isLazyRouteAssetFailure(error: unknown) {
  const message = errorText(error).toLowerCase();
  return [
    'failed to fetch dynamically imported module',
    'error loading dynamically imported module',
    'importing a module script failed',
    'chunkloaderror',
    'loading chunk',
    'unable to preload css',
    'failed to fetch module',
  ].some(fragment => message.includes(fragment));
}

function extractFailedAsset(error: unknown) {
  const match = errorText(error).match(/https?:\/\/[^\s)'"`]+|\/[\w@%+.,~!$&'()\-/:=]+\.(?:js|css)(?:\?[^\s)'"`]*)?/i);
  return match?.[0] || null;
}

export function logRouteLoadFailure(error: unknown, source: 'route-boundary' | 'vite-preload') {
  const entry = {
    at: new Date().toISOString(),
    source,
    route: `${window.location.pathname}${window.location.search}${window.location.hash}`,
    asset: extractFailedAsset(error),
    message: errorText(error),
  };

  console.error('[ServeSync route recovery]', entry, error);
  const storage = getSessionStorage();
  if (!storage) return entry;

  try {
    const previous = JSON.parse(storage.getItem(RECOVERY_LOG_KEY) || '[]');
    const records = Array.isArray(previous) ? previous : [];
    storage.setItem(RECOVERY_LOG_KEY, JSON.stringify([...records.slice(-4), entry]));
  } catch {
    // Diagnostics are best-effort and must never prevent recovery UI from rendering.
  }
  return entry;
}

function readRecoveryMarker(): RecoveryMarker | null {
  const storage = getSessionStorage();
  if (!storage) return null;
  try {
    return JSON.parse(storage.getItem(RECOVERY_MARKER_KEY) || 'null') as RecoveryMarker | null;
  } catch {
    return null;
  }
}

function markRecoveryRefresh(path: string) {
  try {
    const storage = getSessionStorage();
    if (!storage) return false;
    storage.setItem(RECOVERY_MARKER_KEY, JSON.stringify({ path, at: Date.now() } satisfies RecoveryMarker));
    return true;
  } catch {
    return false;
  }
}

export function clearExpiredRouteRecoveryMarker() {
  window.setTimeout(() => {
    const marker = readRecoveryMarker();
    if (marker && Date.now() - marker.at >= RECOVERY_WINDOW_MS) {
      getSessionStorage()?.removeItem(RECOVERY_MARKER_KEY);
    }
  }, RECOVERY_WINDOW_MS + 500);
}

export function installVitePreloadFailureLogging() {
  window.addEventListener('vite:preloadError', event => {
    const preloadEvent = event as Event & { payload?: unknown };
    // Speculative route preloads can fail while a member is typing. Log them, but
    // only the active route error boundary is allowed to initiate recovery.
    logRouteLoadFailure(preloadEvent.payload || new Error('Vite preload failed'), 'vite-preload');
  });
}

export class RouteRecoveryBoundary extends Component<{ children: ReactNode }, RouteRecoveryState> {
  state: RouteRecoveryState = { error: null, failedAsset: null };

  static getDerivedStateFromError(error: Error): RouteRecoveryState {
    return { error, failedAsset: extractFailedAsset(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logRouteLoadFailure(error, 'route-boundary');
    console.error('[ServeSync route component stack]', info.componentStack);

    if (!isLazyRouteAssetFailure(error)) return;

    const path = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const marker = readRecoveryMarker();
    const alreadyRetried = Boolean(
      marker && marker.path === path && Date.now() - marker.at < RECOVERY_WINDOW_MS,
    );

    if (!alreadyRetried) {
      // If storage is restricted, do not risk an uncontrolled refresh loop.
      // The visible recovery screen remains available for a manual reload.
      if (markRecoveryRefresh(path)) window.location.reload();
    }
  }

  private reloadServeSync = () => {
    try {
      getSessionStorage()?.removeItem(RECOVERY_MARKER_KEY);
    } catch {
      // Manual recovery must remain available in restricted storage modes.
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: '24px', background: '#030806', color: '#f8fafc', fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}>
        <section style={{ width: 'min(100%, 520px)', padding: '28px', borderRadius: '24px', border: '1px solid rgba(52, 211, 153, .22)', background: 'linear-gradient(145deg, rgba(6, 30, 21, .96), rgba(8, 11, 18, .98))', boxShadow: '0 24px 80px rgba(0, 0, 0, .45)' }}>
          <div style={{ width: '48px', height: '48px', display: 'grid', placeItems: 'center', borderRadius: '16px', background: 'rgba(16, 185, 129, .14)', color: '#34d399', fontSize: '24px' }}>↻</div>
          <p style={{ margin: '22px 0 6px', color: '#34d399', fontSize: '12px', fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase' }}>ServeSync Recovery</p>
          <h1 style={{ margin: 0, fontSize: 'clamp(26px, 6vw, 38px)', lineHeight: 1.08 }}>This page needs to be reloaded.</h1>
          <p style={{ margin: '16px 0 0', color: '#a7b0ad', fontSize: '15px', lineHeight: 1.65 }}>ServeSync could not load the latest version of this page. Your account and saved information are safe.</p>
          <button onClick={this.reloadServeSync} style={{ width: '100%', marginTop: '24px', minHeight: '50px', border: 0, borderRadius: '14px', background: '#22c98b', color: '#03120c', fontSize: '15px', fontWeight: 800, cursor: 'pointer' }}>Reload ServeSync</button>
          <p style={{ margin: '14px 0 0', color: '#69736f', fontSize: '12px', overflowWrap: 'anywhere' }}>Route: {window.location.pathname}{this.state.failedAsset ? ` · Asset: ${this.state.failedAsset}` : ''}</p>
        </section>
      </main>
    );
  }
}

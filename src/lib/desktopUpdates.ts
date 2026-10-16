import { hasDesktopUpdater } from './desktopPlatform';

export const DESKTOP_CHECK_INTERVAL = 4 * 60 * 60 * 1000;
export type DesktopUpdateState = {
  status: 'idle' | 'checking' | 'current' | 'available' | 'downloading' | 'installing' | 'error';
  installedVersion?: string;
  version?: string;
  notes?: string;
  progress?: number;
  message?: string;
};
export type DownloadProgress =
  | { event: 'Started'; data: { contentLength?: number } }
  | { event: 'Progress'; data: { chunkLength: number } }
  | { event: 'Finished' };

export interface DesktopRelease {
  version: string;
  body?: string;
  downloadAndInstall: (progress: (event: DownloadProgress) => void) => Promise<void>;
  close: () => Promise<void>;
}

type Dependencies = {
  enabled: () => boolean;
  version: () => Promise<string>;
  check: () => Promise<DesktopRelease | null>;
  restart: () => Promise<void>;
  now: () => number;
};

export function createDesktopUpdates(deps: Dependencies) {
  let state: DesktopUpdateState = { status: 'idle' };
  let pending: DesktopRelease | null = null;
  let checkPromise: Promise<void> | null = null;
  let lastAttempt: number | null = null;
  const listeners = new Set<() => void>();
  const set = (next: DesktopUpdateState) => { state = next; listeners.forEach(listener => listener()); };
  const busy = () => state.status === 'downloading' || state.status === 'installing';

  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async check(manual = false) {
      if (!deps.enabled() || busy()) return;
      if (checkPromise) return checkPromise;
      if (!manual && (pending || (lastAttempt !== null && deps.now() - lastAttempt < DESKTOP_CHECK_INTERVAL))) return;
      lastAttempt = deps.now();
      set({ ...state, status: 'checking', message: undefined });
      checkPromise = (async () => {
        try {
          const [installedVersion, release] = await Promise.all([deps.version(), deps.check()]);
          const old = pending;
          pending = release;
          if (old && old !== release) await old.close().catch(() => {});
          set(release
            ? { status: 'available', installedVersion, version: release.version, notes: release.body }
            : { status: 'current', installedVersion });
        } catch {
          set({ ...state, status: 'error', message: 'Could not check Windows updates. Check your connection and try again. The Windows release feed may not be available yet.' });
        } finally { checkPromise = null; }
      })();
      return checkPromise;
    },
    async install() {
      if (!deps.enabled() || !pending || busy() || checkPromise) return;
      const release = pending;
      let downloaded = 0;
      let total: number | undefined;
      set({ ...state, status: 'downloading', progress: undefined, message: undefined });
      try {
        // Only this explicit user action can download or install. Tauri verifies
        // the embedded public-key signature before running the installer.
        await release.downloadAndInstall(event => {
          if (event.event === 'Started') total = event.data.contentLength;
          if (event.event === 'Progress') downloaded += event.data.chunkLength;
          if (event.event === 'Finished') {
            set({ ...state, status: 'installing', progress: 100 });
          } else {
            set({ ...state, progress: total ? Math.min(100, Math.round(downloaded / total * 100)) : undefined });
          }
        });
        // Windows normally exits inside install; this handles a returned install.
        await deps.restart();
      } catch {
        set({ ...state, status: 'error', progress: undefined, message: 'The update could not be installed or verified. ServeSync has not restarted. Check your connection and try again.' });
      }
    },
  };
}

export const desktopUpdates = createDesktopUpdates({
  enabled: hasDesktopUpdater,
  version: async () => (await import('@tauri-apps/api/app')).getVersion(),
  check: async () => (await import('@tauri-apps/plugin-updater')).check({ timeout: 20_000 }),
  restart: async () => (await import('@tauri-apps/plugin-process')).relaunch(),
  now: Date.now,
});

/** Serializes registration and account cleanup so a late token cannot restore an old account. */
export interface NativePushDependencies {
  owner: () => string | null;
  saveOwner: (userId: string | null) => void;
  currentUser: () => Promise<string | null>;
  permission: (ask: boolean) => Promise<boolean>;
  token: () => Promise<string>;
  claim: (token: string) => Promise<void>;
  revoke: () => Promise<void>;
  unregister: () => Promise<void>;
  clearDelivered: () => Promise<void>;
}

export function createNativePushController(deps: NativePushDependencies) {
  let queue: Promise<unknown> = Promise.resolve();
  let generation = 0;
  const serial = <T>(work: () => Promise<T>): Promise<T> => {
    const next = queue.then(work);
    queue = next.catch(() => undefined);
    return next;
  };
  const clean = async () => {
    // Keep the owner on failure, allowing startup/online cleanup to retry.
    await deps.revoke();
    await deps.unregister();
    await deps.clearDelivered();
    deps.saveOwner(null);
  };
  const disable = () => {
    generation += 1;
    return serial(clean);
  };
  const enable = (userId: string, ask = true) => {
    const attempt = generation;
    return serial(async () => {
      if (attempt !== generation || await deps.currentUser() !== userId) return false;
      if (deps.owner() && deps.owner() !== userId) await clean();
      if (!await deps.permission(ask)) {
        if (deps.owner()) await clean();
        if (ask) throw new Error('Allow notifications in Android Settings, then try again.');
        return false;
      }
      const token = await deps.token();
      if (attempt !== generation || await deps.currentUser() !== userId) return false;
      // Persist before the request: an interrupted response still needs cleanup on next startup.
      deps.saveOwner(userId);
      await deps.claim(token);
      if (attempt !== generation || await deps.currentUser() !== userId) {
        await clean();
        return false;
      }
      return true;
    });
  };
  return {
    enable, disable,
    refreshToken(token: string) {
      const attempt = generation;
      const owner = deps.owner();
      return serial(async () => {
        if (!owner || attempt !== generation || deps.owner() !== owner || await deps.currentUser() !== owner) return;
        await deps.claim(token);
      });
    },
    async reconcile(userId: string | null) {
      const owner = deps.owner();
      if (!owner) return false;
      if (owner !== userId) { await disable(); return false; }
      return enable(owner, false);
    },
  };
}

export function nativePushDestination(data: Record<string, unknown>, userId: string): string | null {
  if (data.user_id !== userId) return null;
  const path = data.url;
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')
    || path.includes('\\') || [...path].some(char => char.charCodeAt(0) < 32)) return '/notifications';
  const url = new URL(path, 'https://servesync.invalid');
  return url.origin === 'https://servesync.invalid' ? url.pathname + url.search + url.hash : '/notifications';
}

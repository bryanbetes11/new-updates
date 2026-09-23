type Permission = 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied';
export type NativePushPromptState = 'pending' | 'done';

interface Dependencies {
  owner: () => string | null;
  hasInstallation: () => boolean;
  currentUser: () => Promise<string | null>;
  state: (userId: string) => NativePushPromptState | null;
  saveState: (userId: string, state: NativePushPromptState) => void;
  preferenceEnabled: (userId: string) => Promise<boolean>;
  permission: () => Promise<Permission>;
  requestPermission: () => Promise<Permission>;
  enable: (userId: string) => Promise<boolean>;
}

/** One OS permission request; retry registration failures without repeating the prompt. */
export function createNativePushOnboarding(deps: Dependencies) {
  const inFlight = new Map<string, Promise<void>>();
  const run = async (userId: string) => {
    if (deps.owner() || deps.state(userId) === 'done') return;
    // Older builds have no prompt marker. Do not undo a previous device opt-out/sign-out.
    if (deps.hasInstallation() && !deps.state(userId)) {
      deps.saveState(userId, 'done');
      return;
    }
    if (!await deps.preferenceEnabled(userId)) return;
    if (await deps.currentUser() !== userId || deps.state(userId) === 'done') return;
    let permission = await deps.permission();
    if (await deps.currentUser() !== userId || deps.state(userId) === 'done') return;
    if (permission === 'prompt' && !deps.state(userId)) {
      // Persist before opening OS UI: resume events/remounts must not show a second dialog.
      deps.saveState(userId, 'pending');
      permission = await deps.requestPermission();
    }
    if (permission !== 'granted') {
      deps.saveState(userId, 'done');
      return;
    }
    if (await deps.currentUser() !== userId || deps.state(userId) === 'done') return;
    deps.saveState(userId, 'pending');
    if (await deps.enable(userId)) deps.saveState(userId, 'done');
  };
  return (userId: string) => {
    const existing = inFlight.get(userId);
    if (existing) return existing;
    const task = run(userId).finally(() => inFlight.delete(userId));
    inFlight.set(userId, task);
    return task;
  };
}

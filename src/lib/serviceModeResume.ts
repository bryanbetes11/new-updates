const SERVICE_MODE_RESUME_KEY = 'servesync:active-service-mode';
const SERVICE_MODE_RESUME_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export interface ServiceModeResumeState {
  eventId: string;
  songIndex: number;
  updatedAt: number;
}

function getLocalStorage() {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function removeStoredServiceMode() {
  const storage = getLocalStorage();
  if (!storage) return;

  try {
    storage.removeItem(SERVICE_MODE_RESUME_KEY);
  } catch {
    // Service-mode resume is optional; storage failures should not block rendering.
  }
}

export function getActiveServiceMode(): ServiceModeResumeState | null {
  const storage = getLocalStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(SERVICE_MODE_RESUME_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<ServiceModeResumeState>;
    if (!parsed.eventId || typeof parsed.songIndex !== 'number' || typeof parsed.updatedAt !== 'number') {
      removeStoredServiceMode();
      return null;
    }

    if (Date.now() - parsed.updatedAt > SERVICE_MODE_RESUME_MAX_AGE_MS) {
      removeStoredServiceMode();
      return null;
    }

    return {
      eventId: parsed.eventId,
      songIndex: Math.max(0, parsed.songIndex),
      updatedAt: parsed.updatedAt,
    };
  } catch {
    removeStoredServiceMode();
    return null;
  }
}

export function saveActiveServiceMode(eventId: string, songIndex: number) {
  const storage = getLocalStorage();
  if (!storage) return;

  try {
    storage.setItem(
      SERVICE_MODE_RESUME_KEY,
      JSON.stringify({
        eventId,
        songIndex: Math.max(0, songIndex),
        updatedAt: Date.now(),
      } satisfies ServiceModeResumeState)
    );
  } catch {
    // Service-mode resume is optional; storage failures should not block rendering.
  }
}

export function clearActiveServiceMode(eventId?: string) {
  const current = getActiveServiceMode();
  if (eventId && current && current.eventId !== eventId) return;
  removeStoredServiceMode();
}

export function serviceModeResumePath(state: ServiceModeResumeState) {
  return `/events/${state.eventId}?mode=restore&song=${state.songIndex}`;
}

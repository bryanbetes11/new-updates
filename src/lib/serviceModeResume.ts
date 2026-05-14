const SERVICE_MODE_RESUME_KEY = 'servesync:active-service-mode';
const SERVICE_MODE_RESUME_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export interface ServiceModeResumeState {
  eventId: string;
  songIndex: number;
  updatedAt: number;
}

export function getActiveServiceMode(): ServiceModeResumeState | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(SERVICE_MODE_RESUME_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<ServiceModeResumeState>;
    if (!parsed.eventId || typeof parsed.songIndex !== 'number' || typeof parsed.updatedAt !== 'number') {
      window.localStorage.removeItem(SERVICE_MODE_RESUME_KEY);
      return null;
    }

    if (Date.now() - parsed.updatedAt > SERVICE_MODE_RESUME_MAX_AGE_MS) {
      window.localStorage.removeItem(SERVICE_MODE_RESUME_KEY);
      return null;
    }

    return {
      eventId: parsed.eventId,
      songIndex: Math.max(0, parsed.songIndex),
      updatedAt: parsed.updatedAt,
    };
  } catch {
    window.localStorage.removeItem(SERVICE_MODE_RESUME_KEY);
    return null;
  }
}

export function saveActiveServiceMode(eventId: string, songIndex: number) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(
    SERVICE_MODE_RESUME_KEY,
    JSON.stringify({
      eventId,
      songIndex: Math.max(0, songIndex),
      updatedAt: Date.now(),
    } satisfies ServiceModeResumeState)
  );
}

export function clearActiveServiceMode(eventId?: string) {
  if (typeof window === 'undefined') return;

  const current = getActiveServiceMode();
  if (eventId && current && current.eventId !== eventId) return;
  window.localStorage.removeItem(SERVICE_MODE_RESUME_KEY);
}

export function serviceModeResumePath(state: ServiceModeResumeState) {
  return `/events/${state.eventId}?mode=restore&song=${state.songIndex}`;
}

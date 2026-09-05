const SERVICE_MODE_RESUME_KEY = 'servesync:active-service-mode';
const SERVICE_MODE_RESUME_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export interface ServiceModeResumeState {
  eventId: string;
  songIndex: number;
  updatedAt: number;
  audience?: 'stage' | 'tech';
  orgId?: string;
  userId?: string;
  songId?: string;
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

export function getActiveServiceMode(orgId?: string | null, userId?: string): ServiceModeResumeState | null {
  const storage = getLocalStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(SERVICE_MODE_RESUME_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<ServiceModeResumeState>;
    if (!parsed.eventId || !Number.isInteger(parsed.songIndex) || !Number.isFinite(parsed.updatedAt)) {
      removeStoredServiceMode();
      return null;
    }

    if (Date.now() - parsed.updatedAt! > SERVICE_MODE_RESUME_MAX_AGE_MS || parsed.updatedAt! > Date.now()+60000 || (userId && (parsed.userId !== userId || parsed.orgId !== orgId))) {
      removeStoredServiceMode();
      return null;
    }

    return {
      eventId: parsed.eventId,
      songIndex: Math.max(0, parsed.songIndex!),
      updatedAt: parsed.updatedAt!,
      audience: parsed.audience === 'tech' ? 'tech' : 'stage',
      userId: parsed.userId, orgId: parsed.orgId, songId: parsed.songId,
    };
  } catch {
    removeStoredServiceMode();
    return null;
  }
}

export function saveActiveServiceMode(eventId: string, songIndex: number, audience: 'stage' | 'tech' = 'stage', orgId?: string | null, userId?: string, songId?: string) {
  const storage = getLocalStorage();
  if (!storage) return;

  try {
    storage.setItem(
      SERVICE_MODE_RESUME_KEY,
      JSON.stringify({
        eventId,
        songIndex: Math.max(0, songIndex),
        updatedAt: Date.now(),
        audience, orgId: orgId || undefined, userId, songId,
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
  return `/events/${state.eventId}?mode=restore&song=${state.songIndex}&audience=${state.audience || 'stage'}`;
}

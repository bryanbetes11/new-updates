import { getKeyTransposeOffset, transposeKey } from './chordPro';

export const MAX_CAPO_FRET = 12;
export type PersonalCapoSetting = { fret: number; enabled: boolean };
export type PersonalCapo = PersonalCapoSetting & { pending: boolean };

export function isCapoFret(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_CAPO_FRET;
}

export function parsePersonalCapoSetting(value: unknown): PersonalCapoSetting | null {
  // Earlier saved preferences used only the active fret.
  if (isCapoFret(value)) return { fret: value, enabled: value > 0 };
  if (!value || typeof value !== 'object' || !('fret' in value) || !isCapoFret(value.fret)) return null;
  if ('enabled' in value && typeof value.enabled !== 'boolean') return null;
  return { fret: value.fret, enabled: value.fret > 0 && ('enabled' in value ? value.enabled === true : true) };
}

export function personalCapoStorageId(orgId?: string | null, userId?: string, songId?: string) {
  return orgId && userId && songId ? `servesync:personal-capo:${orgId}:${userId}:${songId}` : null;
}

export function personalCapoPreferenceKey(orgId: string, songId: string) {
  return `personal-chart-capo:${orgId}:${songId}`;
}

export function readPersonalCapo(storageId: string | null): PersonalCapo | null {
  if (!storageId) return null;
  try {
    const raw = localStorage.getItem(storageId);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || !('fret' in value) || !('pending' in value)) return null;
    const setting = parsePersonalCapoSetting(value);
    return setting && typeof value.pending === 'boolean' ? { ...setting, pending: value.pending } : null;
  } catch { return null; }
}

export function writePersonalCapo(storageId: string | null, value: PersonalCapo) {
  if (!storageId || !isCapoFret(value.fret) || typeof value.enabled !== 'boolean') return false;
  try { localStorage.setItem(storageId, JSON.stringify(value)); return true; }
  catch { return false; }
}

type GuitarAssignment = { user_id: string; status: string; roles?: { name: string } | null };

export function isGuitarRole(name?: string | null) {
  return /^(?:(?:acoustic|electric|lead|rhythm)\s+)?guitar(?:ist)?(?:\s+\d+)?$/i.test(name?.trim() || '');
}

export function isEventGuitarist(assignments: GuitarAssignment[], userId?: string) {
  return Boolean(userId && assignments.some(assignment => assignment.user_id === userId
    && assignment.status !== 'declined'
    && isGuitarRole(assignment.roles?.name)));
}

/** Capo lowers the displayed shapes while preserving the set's sounding key. */
export function getCapoChartView(sourceKey: string, setKey: string, personalKey: string | null, fret: number, enabled: boolean) {
  const hasKey = Boolean(transposeKey(sourceKey, 0));
  const capo = enabled && hasKey && isCapoFret(fret) ? fret : 0;
  const soundingKey = setKey || sourceKey;
  const viewKey = capo > 0 ? soundingKey : personalKey || soundingKey;
  const transpose = getKeyTransposeOffset(sourceKey, viewKey) - capo;
  return { capo, soundingKey, transpose, shapesKey: sourceKey ? transposeKey(sourceKey, transpose) : '', hasKey };
}

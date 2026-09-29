import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';

export const SONG_READINESS_RULE_DAYS = 90;

export interface SongReadinessProjection {
  daysAtTarget: number | null;
  isExempt: boolean;
  meetsRule: boolean;
  readyDate: string | null;
  shortfallDays: number;
}

const SONG_READINESS_EXEMPT_EVENT_TYPES = new Set([
  'prayer meeting',
  'lgtf (midweek)',
  'midweek',
]);

function normalizeEventType(eventType: string | null | undefined) {
  return (eventType || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function isSongReadinessRuleExempt(eventType: string | null | undefined) {
  return SONG_READINESS_EXEMPT_EVENT_TYPES.has(normalizeEventType(eventType));
}

export function projectSongReadiness(
  lastUsedDate: string | null | undefined,
  targetDate: string,
  ruleDays = SONG_READINESS_RULE_DAYS,
): SongReadinessProjection {
  if (!lastUsedDate) {
    return {
      daysAtTarget: null,
      isExempt: false,
      meetsRule: true,
      readyDate: null,
      shortfallDays: 0,
    };
  }

  const lastUsed = parseISO(lastUsedDate);
  const daysAtTarget = differenceInCalendarDays(parseISO(targetDate), lastUsed);
  const readyDate = format(addDays(lastUsed, ruleDays), 'yyyy-MM-dd');

  return {
    daysAtTarget,
    isExempt: false,
    meetsRule: daysAtTarget >= ruleDays,
    readyDate,
    shortfallDays: Math.max(ruleDays - daysAtTarget, 0),
  };
}

export function projectSongReadinessForEvent(
  lastUsedDate: string | null | undefined,
  targetDate: string,
  eventType: string | null | undefined,
  ruleDays = SONG_READINESS_RULE_DAYS,
): SongReadinessProjection {
  const projection = projectSongReadiness(lastUsedDate, targetDate, ruleDays);

  if (!isSongReadinessRuleExempt(eventType)) return projection;

  return {
    ...projection,
    isExempt: true,
    meetsRule: true,
    readyDate: null,
    shortfallDays: 0,
  };
}

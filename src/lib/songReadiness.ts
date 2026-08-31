import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';

export const SONG_READINESS_RULE_DAYS = 90;

export interface SongReadinessProjection {
  daysAtTarget: number | null;
  meetsRule: boolean;
  readyDate: string | null;
  shortfallDays: number;
}

export function projectSongReadiness(
  lastUsedDate: string | null | undefined,
  targetDate: string,
  ruleDays = SONG_READINESS_RULE_DAYS,
): SongReadinessProjection {
  if (!lastUsedDate) {
    return {
      daysAtTarget: null,
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
    meetsRule: daysAtTarget >= ruleDays,
    readyDate,
    shortfallDays: Math.max(ruleDays - daysAtTarget, 0),
  };
}

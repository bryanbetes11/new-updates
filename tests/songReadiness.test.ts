import { isSongReadinessRuleExempt, projectSongReadiness, projectSongReadinessForEvent } from '../src/lib/songReadiness';

function expectEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

const meetsByEvent = projectSongReadiness('2026-06-27', '2026-09-20');
expectEqual(meetsByEvent.daysAtTarget, 85, 'projects age directly to the event date');
expectEqual(meetsByEvent.meetsRule, false, '85 days does not meet the 90-day rule');
expectEqual(meetsByEvent.shortfallDays, 5, 'reports the exact event-day shortfall');
expectEqual(meetsByEvent.readyDate, '2026-09-25', 'reports the date the song becomes eligible');

const readyByEvent = projectSongReadiness('2026-06-07', '2026-09-20');
expectEqual(readyByEvent.daysAtTarget, 105, 'projects a ready song to the event date');
expectEqual(readyByEvent.meetsRule, true, '105 days meets the rule');
expectEqual(readyByEvent.shortfallDays, 0, 'ready songs have no shortfall');

const neverUsed = projectSongReadiness(null, '2026-09-20');
expectEqual(neverUsed.daysAtTarget, null, 'never-used songs have no age');
expectEqual(neverUsed.meetsRule, true, 'never-used songs are eligible');
expectEqual(neverUsed.readyDate, null, 'never-used songs do not need an eligibility date');

const recentlyUsedDate = '2026-09-01';
const targetDate = '2026-09-20';
for (const eventType of ['Prayer Meeting', 'LGTF (Midweek)', 'Midweek', '  PRAYER   MEETING  ']) {
  const projection = projectSongReadinessForEvent(recentlyUsedDate, targetDate, eventType);
  expectEqual(projection.isExempt, true, `${eventType} is marked exempt`);
  expectEqual(projection.meetsRule, true, `${eventType} bypasses the 90-day rule`);
  expectEqual(projection.shortfallDays, 0, `${eventType} has no readiness shortfall`);
  expectEqual(projection.readyDate, null, `${eventType} does not need a readiness date`);
}

const sundayProjection = projectSongReadinessForEvent(recentlyUsedDate, targetDate, 'Sunday Service');
expectEqual(sundayProjection.isExempt, false, 'Sunday Service is not exempt');
expectEqual(sundayProjection.meetsRule, false, 'Sunday Service still enforces the 90-day rule');
expectEqual(sundayProjection.shortfallDays, 71, 'Sunday Service keeps the calculated shortfall');
expectEqual(isSongReadinessRuleExempt('Midweek Rehearsal'), false, 'similar custom event types are not exempt');

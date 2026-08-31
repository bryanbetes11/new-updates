import { projectSongReadiness } from '../src/lib/songReadiness';

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

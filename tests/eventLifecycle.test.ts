import { getEventScheduledEnd, hasEventScheduleEnded, isEventCompleted } from '../src/lib/eventLifecycle';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const event = {
  event_date: '2026-08-09',
  start_time: '07:30',
  end_time: '11:30',
  lifecycle_override: null,
};

assert(
  getEventScheduledEnd(event).toISOString() === '2026-08-09T03:30:00.000Z',
  'The scheduled end should interpret event times in Asia/Manila (+08:00).',
);
assert(
  !hasEventScheduleEnded(event, new Date('2026-08-09T03:29:59.000Z')),
  'An event schedule should remain active before its scheduled end.',
);
assert(
  hasEventScheduleEnded(event, new Date('2026-08-09T03:30:00.000Z')),
  'An event schedule should be marked finished at its scheduled end.',
);
assert(
  !isEventCompleted(event),
  'A finished event should stay in Upcoming until an admin moves it manually.',
);
assert(
  isEventCompleted({ ...event, event_date: '2026-08-08' }),
  'Events before the manual lifecycle launch date should remain in Past events.',
);
assert(
  isEventCompleted({ ...event, lifecycle_override: 'completed' }),
  'A completed override should move an event to Past.',
);
assert(
  !isEventCompleted({ ...event, lifecycle_override: 'upcoming' }),
  'An upcoming override should keep an event in Upcoming.',
);
assert(
  hasEventScheduleEnded(
    { ...event, end_time: null },
    new Date('2026-08-08T23:30:00.000Z'),
  ),
  'When no end time exists, the start time should be the completion boundary.',
);

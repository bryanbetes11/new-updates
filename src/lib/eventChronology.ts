export interface ScheduledEventLike {
  event_date: string;
  start_time?: string | null;
}

const END_OF_DAY = '23:59:59.999';

export function eventScheduleKey(event: ScheduledEventLike) {
  const startTime = event.start_time?.trim() || END_OF_DAY;
  return `${event.event_date}T${startTime}`;
}

export function compareEventSchedule(
  a: ScheduledEventLike,
  b: ScheduledEventLike,
  direction: 'ascending' | 'descending' = 'ascending',
) {
  const comparison = eventScheduleKey(a).localeCompare(eventScheduleKey(b));
  return direction === 'descending' ? -comparison : comparison;
}

import type { Event } from '../types';

export const EVENT_TIMEZONE_OFFSET = '+08:00';
export const MANUAL_EVENT_LIFECYCLE_START_DATE = '2026-08-09';

export type EventLifecycleOverride = 'upcoming' | 'completed';

export function getEventScheduledEnd(event: Pick<Event, 'event_date' | 'start_time' | 'end_time'>) {
  const endTime = event.end_time || event.start_time || '23:59';
  return new Date(`${event.event_date}T${endTime}${EVENT_TIMEZONE_OFFSET}`);
}

export function isEventCompleted(
  event: Pick<Event, 'event_date' | 'lifecycle_override'>,
) {
  if (event.lifecycle_override === 'completed') return true;
  if (event.lifecycle_override === 'upcoming') return false;

  return event.event_date < MANUAL_EVENT_LIFECYCLE_START_DATE;
}

export function hasEventScheduleEnded(
  event: Pick<Event, 'event_date' | 'start_time' | 'end_time'>,
  now = new Date(),
) {
  return now >= getEventScheduledEnd(event);
}

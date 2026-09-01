import assert from 'node:assert/strict';
import { compareEventSchedule, eventScheduleKey } from '../src/lib/eventChronology';

const sundayService = { event_date: '2026-09-05', start_time: '07:30:00' };
const rehearsal = { event_date: '2026-09-05', start_time: '16:30:00' };
const youthRecharge = { event_date: '2026-09-05', start_time: '16:00:00' };

const upcoming = [youthRecharge, rehearsal, sundayService].sort(compareEventSchedule);
assert.deepEqual(
  upcoming,
  [sundayService, youthRecharge, rehearsal],
  'same-day upcoming events should be arranged from earliest to latest start time',
);

const past = [sundayService, youthRecharge, rehearsal].sort((a, b) => compareEventSchedule(a, b, 'descending'));
assert.deepEqual(
  past,
  [rehearsal, youthRecharge, sundayService],
  'past events should retain reverse chronological date-and-time ordering',
);

assert.ok(
  eventScheduleKey({ event_date: '2026-09-05', start_time: null }) > eventScheduleKey(rehearsal),
  'events without a start time should appear after timed events on the same day',
);

-- The policy restoration backfill is intentionally limited to the active
-- accountability quarter. Remove only the older rows created by that exact
-- backfill statement; preserve pre-existing automatic attendance records.

delete from public.event_attendance attendance
using public.events event
where event.id = attendance.event_id
  and attendance.record_source = 'automatic'
  and attendance.notes = 'Auto-marked absent (no attendance submitted)'
  and attendance.created_at = timestamptz '2026-08-16 18:38:57.702592+00'
  and event.event_date < date '2026-07-01';

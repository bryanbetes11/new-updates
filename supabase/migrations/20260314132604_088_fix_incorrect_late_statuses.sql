/*
  # Fix Incorrect Late Attendance Statuses

  ## Problem
  The attendance self-check-in logic previously used an inverted grace period:
  it compared check-in time against (start_time - 5 minutes), meaning anyone
  who checked in within 5 minutes BEFORE the event started was wrongly marked late.

  ## Fix
  The correct rule is: mark as late only if check-in is MORE THAN 5 minutes
  after the event start_time. Anyone who checked in before or within 5 minutes
  after start should be 'present'.

  ## Changes
  - Re-evaluates all self-checked (non-leader-overridden) 'late' attendance records
  - Converts records to 'present' where check-in was at or before (start_time + 5 min grace)
  - Only affects records without a leader override (override_by IS NULL)
  - Uses Asia/Manila timezone for the comparison (same as the frontend logic)
*/

UPDATE event_attendance ea
SET 
  status = 'present',
  updated_at = now()
FROM events e
WHERE ea.event_id = e.id
  AND ea.status = 'late'
  AND ea.override_by IS NULL
  AND ea.checked_in_at IS NOT NULL
  AND e.start_time IS NOT NULL
  AND (
    ea.checked_in_at AT TIME ZONE 'Asia/Manila'
    <=
    (
      (e.event_date::text || ' ' || e.start_time::text)::timestamptz AT TIME ZONE 'Asia/Manila'
      + interval '5 minutes'
    ) AT TIME ZONE 'Asia/Manila'
  );

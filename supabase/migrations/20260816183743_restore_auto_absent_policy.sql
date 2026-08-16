-- Restore the documented attendance rule: a finalized assignment with no
-- attendance submission is recorded as absent after the reminder window.
-- Automatic records retain their source so leaders can audit and correct them.

update public.event_attendance
set review_status = 'verified',
    reviewed_by = null,
    reviewed_at = null
where status = 'absent'
  and record_source = 'automatic'
  and review_status = 'needs_review';

with accountable_assignments as (
  select distinct on (assignment.org_id, assignment.event_id, assignment.user_id)
    assignment.org_id,
    assignment.event_id,
    assignment.user_id
  from public.event_assignments assignment
  join public.events event
    on event.id = assignment.event_id
   and event.org_id = assignment.org_id
  where assignment.status <> 'declined'
    and event.event_date <= timezone('Asia/Manila', now())::date - 2
  order by assignment.org_id, assignment.event_id, assignment.user_id,
    case assignment.status when 'confirmed' then 1 else 2 end,
    assignment.created_at,
    assignment.id
)
insert into public.event_attendance (
  org_id,
  event_id,
  user_id,
  status,
  checked_in_at,
  is_assigned,
  notes,
  record_source,
  review_status
)
select
  assignment.org_id,
  assignment.event_id,
  assignment.user_id,
  'absent',
  null,
  true,
  'Auto-marked absent (no attendance submitted)',
  'automatic',
  'verified'
from accountable_assignments assignment
on conflict (event_id, user_id) do nothing;

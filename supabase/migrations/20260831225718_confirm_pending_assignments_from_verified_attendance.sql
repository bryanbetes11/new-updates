-- A verified present/late attendance record is stronger evidence than a
-- pending schedule response. Confirm every still-pending assignment for the
-- member on that event without overriding explicit declines.
create or replace function private.confirm_pending_assignments_from_attendance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status not in ('present', 'late')
     or new.review_status <> 'verified' then
    return new;
  end if;

  update public.event_assignments assignment
  set status = 'confirmed',
      confirmed_at = coalesce(new.checked_in_at, new.marked_at, now()),
      decline_reason = null
  where assignment.event_id = new.event_id
    and assignment.user_id = new.user_id
    and assignment.org_id = new.org_id
    and assignment.status = 'pending';

  return new;
end;
$$;

drop trigger if exists trg_confirm_pending_assignments_from_attendance
  on public.event_attendance;
create trigger trg_confirm_pending_assignments_from_attendance
after insert or update of status, review_status
on public.event_attendance
for each row
when (
  new.status in ('present', 'late')
  and new.review_status = 'verified'
)
execute function private.confirm_pending_assignments_from_attendance();

revoke all on function private.confirm_pending_assignments_from_attendance()
  from public, anon, authenticated;

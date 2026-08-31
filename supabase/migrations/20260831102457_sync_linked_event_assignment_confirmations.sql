-- Confirming either side of a linked Sunday-service/rehearsal assignment confirms
-- the matching member and role on the other event. Declines remain independent.
create or replace function private.sync_linked_assignment_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_confirmed_at timestamptz := coalesce(new.confirmed_at, now());
begin
  if new.status <> 'confirmed' or old.status = 'confirmed' then
    return new;
  end if;

  if new.source_assignment_id is not null then
    update public.event_assignments source_assignment
    set
      status = 'confirmed',
      confirmed_at = v_confirmed_at,
      decline_reason = null
    where source_assignment.id = new.source_assignment_id
      and source_assignment.org_id = new.org_id
      and source_assignment.status is distinct from 'confirmed';
  else
    update public.event_assignments rehearsal_assignment
    set
      status = 'confirmed',
      confirmed_at = v_confirmed_at,
      decline_reason = null
    where rehearsal_assignment.source_assignment_id = new.id
      and rehearsal_assignment.org_id = new.org_id
      and rehearsal_assignment.status is distinct from 'confirmed';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_linked_assignment_confirmation
  on public.event_assignments;
create trigger trg_sync_linked_assignment_confirmation
after update of status on public.event_assignments
for each row
when (new.status = 'confirmed' and old.status is distinct from new.status)
execute function private.sync_linked_assignment_confirmation();

revoke all on function private.sync_linked_assignment_confirmation()
  from public, anon, authenticated;

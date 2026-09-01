-- Confirming a linked service or rehearsal assignment confirms the matching
-- member/role assignment on the other event. Declines remain independent.
--
-- The event relationship fallback keeps legacy assignment rows working even
-- when they predate source_assignment_id backfilling.
create or replace function private.sync_linked_assignment_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_confirmed_at timestamptz := coalesce(new.confirmed_at, now());
  v_event public.events%rowtype;
begin
  if new.status <> 'confirmed' or old.status = 'confirmed' then
    return new;
  end if;

  select event.*
  into v_event
  from public.events event
  where event.id = new.event_id
    and event.org_id = new.org_id;

  if not found then
    return new;
  end if;

  perform set_config('servesync.linked_confirmation_sync', '1', true);

  if lower(coalesce(v_event.event_type, '')) in ('rehearsal', 'rehearsals')
     and v_event.linked_event_id is not null then
    update public.event_assignments service_assignment
    set status = 'confirmed',
        confirmed_at = v_confirmed_at,
        decline_reason = null
    where service_assignment.org_id = new.org_id
      and service_assignment.status is distinct from 'confirmed'
      and (
        service_assignment.id = new.source_assignment_id
        or (
          service_assignment.event_id = v_event.linked_event_id
          and service_assignment.user_id = new.user_id
          and service_assignment.role_id = new.role_id
        )
      );
  else
    update public.event_assignments rehearsal_assignment
    set status = 'confirmed',
        confirmed_at = v_confirmed_at,
        decline_reason = null
    from public.events rehearsal
    where rehearsal.id = rehearsal_assignment.event_id
      and rehearsal.org_id = new.org_id
      and rehearsal.linked_event_id = new.event_id
      and lower(coalesce(rehearsal.event_type, '')) in ('rehearsal', 'rehearsals')
      and rehearsal_assignment.org_id = new.org_id
      and rehearsal_assignment.user_id = new.user_id
      and rehearsal_assignment.role_id = new.role_id
      and rehearsal_assignment.status is distinct from 'confirmed';
  end if;

  perform set_config('servesync.linked_confirmation_sync', '0', true);
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

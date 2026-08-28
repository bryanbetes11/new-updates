-- Keep linked rehearsal teams aligned with their service while preserving
-- rehearsal-only assignments. The service assignment is the source of truth.

alter table public.event_assignments
  add column if not exists source_assignment_id uuid;

alter table public.event_assignments
  add column if not exists synced_from_linked_service boolean not null default false;

create unique index if not exists event_assignments_id_org_id_key
  on public.event_assignments (id, org_id);

alter table public.event_assignments
  drop constraint if exists event_assignments_source_assignment_org_fkey;

alter table public.event_assignments
  add constraint event_assignments_source_assignment_org_fkey
  foreign key (source_assignment_id, org_id)
  references public.event_assignments (id, org_id)
  on delete cascade;

create index if not exists event_assignments_source_assignment_id_idx
  on public.event_assignments (source_assignment_id)
  where source_assignment_id is not null;

create or replace function private.tag_linked_rehearsal_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source_assignment_id is not null then
    return new;
  end if;

  select source_assignment.id
  into new.source_assignment_id
  from public.events rehearsal
  join public.events service
    on service.id = rehearsal.linked_event_id
   and service.org_id = rehearsal.org_id
  join public.event_assignments source_assignment
    on source_assignment.event_id = service.id
   and source_assignment.org_id = service.org_id
   and source_assignment.user_id = new.user_id
   and source_assignment.role_id = new.role_id
   and source_assignment.source_assignment_id is null
  join public.roles role on role.id = source_assignment.role_id
  where rehearsal.id = new.event_id
    and rehearsal.org_id = new.org_id
    and rehearsal.event_type = 'Rehearsals'
    and role.is_leadership = false
    and role.name <> 'Song Leader'
  limit 1;

  return new;
end;
$$;

drop trigger if exists trg_tag_linked_rehearsal_assignment
  on public.event_assignments;
create trigger trg_tag_linked_rehearsal_assignment
before insert on public.event_assignments
for each row execute function private.tag_linked_rehearsal_assignment();

-- Associate existing copied rehearsal rows with their matching service rows.
-- This is metadata-only and does not create notifications.
update public.event_assignments rehearsal_assignment
set source_assignment_id = source_assignment.id
from public.events rehearsal
join public.events service
  on service.id = rehearsal.linked_event_id
 and service.org_id = rehearsal.org_id
join public.event_assignments source_assignment
  on source_assignment.event_id = service.id
 and source_assignment.org_id = service.org_id
 and source_assignment.source_assignment_id is null
join public.roles role
  on role.id = source_assignment.role_id
 and role.is_leadership = false
 and role.name <> 'Song Leader'
where rehearsal_assignment.event_id = rehearsal.id
  and rehearsal_assignment.org_id = rehearsal.org_id
  and rehearsal.event_type = 'Rehearsals'
  and rehearsal_assignment.user_id = source_assignment.user_id
  and rehearsal_assignment.role_id = source_assignment.role_id
  and rehearsal_assignment.source_assignment_id is null
  -- A few legacy declined rows predate the required-reason constraint. Updating
  -- any column on those rows would revalidate and fail the whole migration.
  and not (
    rehearsal_assignment.status = 'declined'
    and nullif(btrim(rehearsal_assignment.decline_reason), '') is null
  );

create or replace function private.sync_assignment_to_linked_rehearsals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Derived rehearsal rows and rehearsal-only assignments must not fan out.
  if new.source_assignment_id is not null then
    return new;
  end if;

  if not exists (
    select 1
    from public.events source_event
    join public.roles role on role.id = new.role_id
    where source_event.id = new.event_id
      and source_event.org_id = new.org_id
      and source_event.event_type <> 'Rehearsals'
      and role.is_leadership = false
      and role.name <> 'Song Leader'
  ) then
    return new;
  end if;

  insert into public.event_assignments (
    event_id,
    user_id,
    role_id,
    source_assignment_id,
    synced_from_linked_service
  )
  select
    rehearsal.id,
    new.user_id,
    new.role_id,
    new.id,
    true
  from public.events rehearsal
  where rehearsal.linked_event_id = new.event_id
    and rehearsal.org_id = new.org_id
    and rehearsal.event_type = 'Rehearsals'
  on conflict (event_id, user_id, role_id)
  do update set source_assignment_id = excluded.source_assignment_id
  where not (
    event_assignments.status = 'declined'
    and nullif(btrim(event_assignments.decline_reason), '') is null
  );

  return new;
end;
$$;

drop trigger if exists trg_sync_assignment_to_linked_rehearsals
  on public.event_assignments;
create trigger trg_sync_assignment_to_linked_rehearsals
after insert on public.event_assignments
for each row execute function private.sync_assignment_to_linked_rehearsals();

-- A service assignment already produces the user-facing notification. Suppress
-- the derived rehearsal insert so one team update does not create duplicates.
drop trigger if exists trg_event_assignment_created
  on public.event_assignments;
create trigger trg_event_assignment_created
after insert on public.event_assignments
for each row
when (new.synced_from_linked_service = false)
execute function public.on_event_assignment_created();

revoke all on function private.tag_linked_rehearsal_assignment() from public, anon, authenticated;
revoke all on function private.sync_assignment_to_linked_rehearsals() from public, anon, authenticated;

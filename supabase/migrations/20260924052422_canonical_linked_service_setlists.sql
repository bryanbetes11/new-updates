-- A linked rehearsal and its Sunday Service share the service's setlist.
-- Keep the setlist id: songs, review history, comments, and receipts all refer
-- to it. Abort on conflicts so no existing proposal is removed or overwritten.
do $$
begin
  if exists (
    select 1
    from public.setlists proposal
    join public.events rehearsal on rehearsal.id = proposal.event_id
    left join public.events service on service.id = rehearsal.linked_event_id
    where rehearsal.event_type = 'Rehearsals'
      and rehearsal.linked_event_id is not null
      and (service.id is null or service.event_type <> 'Sunday Service'
        or service.org_id is distinct from rehearsal.org_id
        or proposal.org_id is distinct from rehearsal.org_id)
  ) then
    raise exception 'Linked rehearsal setlist has an invalid or cross-church Sunday Service; inspect before migration.';
  end if;

  if exists (
    select 1
    from public.setlists proposal
    join public.events rehearsal on rehearsal.id = proposal.event_id
    join public.setlists existing on existing.event_id = rehearsal.linked_event_id
    where rehearsal.event_type = 'Rehearsals'
      and rehearsal.linked_event_id is not null
  ) then
    raise exception 'Linked Sunday Service already has a setlist; resolve both proposals before migration.';
  end if;

  if exists (
    select 1
    from public.setlists proposal
    join public.events rehearsal on rehearsal.id = proposal.event_id
    where rehearsal.event_type = 'Rehearsals'
      and rehearsal.linked_event_id is not null
    group by rehearsal.linked_event_id
    having count(*) > 1
  ) then
    raise exception 'Multiple linked rehearsal setlists target one Sunday Service; resolve before migration.';
  end if;
end;
$$;

-- This is a reference correction, not a user edit. Avoid changing the last
-- edited timestamp or adding a misleading activity entry. Status is unchanged,
-- so the existing status-notification trigger emits nothing.
alter table public.setlists disable trigger setlists_set_last_edited_at;
alter table public.setlists disable trigger trg_activity_setlists;

update public.setlists proposal
set event_id = rehearsal.linked_event_id
from public.events rehearsal
join public.events service on service.id = rehearsal.linked_event_id
where proposal.event_id = rehearsal.id
  and rehearsal.event_type = 'Rehearsals'
  and service.event_type = 'Sunday Service'
  and rehearsal.org_id = service.org_id
  and proposal.org_id = rehearsal.org_id;

alter table public.setlists enable trigger trg_activity_setlists;
alter table public.setlists enable trigger setlists_set_last_edited_at;

-- An older app can still submit against the rehearsal id. Resolve that id
-- before storing the row, and serialize inserts on the service event row so
-- two proposals cannot race into the same canonical event. The guard applies
-- only to services with a linked rehearsal; unrelated service workflows keep
-- their existing behavior.
create or replace function private.canonicalize_linked_setlist_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_event record;
  target_event record;
  check_duplicate boolean;
begin
  -- Serialize a setlist insert with a concurrent event-link change. Otherwise
  -- the insert could read the old standalone link while the event is relinked.
  select id, org_id, event_type, linked_event_id into source_event
  from public.events where id = new.event_id for update;

  if not found then
    raise exception 'Setlist event does not exist.' using errcode = '23503';
  end if;

  if source_event.event_type = 'Rehearsals' and source_event.linked_event_id is not null then
    select id, org_id, event_type into target_event
    from public.events where id = source_event.linked_event_id for update;
    if not found or target_event.event_type <> 'Sunday Service'
      or target_event.org_id is distinct from source_event.org_id then
      raise exception 'Linked rehearsal must point to a Sunday Service in the same church.'
        using errcode = '23514';
    end if;
    new.event_id := target_event.id;
  else
    target_event := source_event;
    if source_event.event_type = 'Sunday Service' then
      perform 1 from public.events where id = source_event.id for update;
    end if;
  end if;

  if new.org_id is null then
    new.org_id := target_event.org_id;
  elsif new.org_id is distinct from target_event.org_id then
    raise exception 'Setlist and event must belong to the same church.'
      using errcode = '23514';
  end if;

  check_duplicate := tg_op = 'INSERT';
  if tg_op = 'UPDATE' then
    check_duplicate := new.event_id is distinct from old.event_id;
  end if;
  if check_duplicate and target_event.event_type = 'Sunday Service'
    and exists (
      select 1 from public.events rehearsal
      where rehearsal.linked_event_id = target_event.id
        and rehearsal.event_type = 'Rehearsals'
        and rehearsal.org_id = target_event.org_id
    )
    and exists (
      select 1 from public.setlists existing
      where existing.event_id = new.event_id
        and existing.id is distinct from new.id
    ) then
    raise exception 'Sunday Service already has a setlist.' using errcode = '23505';
  end if;

  return new;
end;
$$;

revoke all on function private.canonicalize_linked_setlist_event()
  from public, anon, authenticated;
create trigger trg_canonicalize_linked_setlist_event
  before insert or update of event_id, org_id on public.setlists
  for each row execute function private.canonicalize_linked_setlist_event();

-- A proposal may be drafted while a rehearsal is standalone. Moving the
-- rehearsal into a linked pair must move that proposal in the same transaction.
-- Changing an established link cannot silently abandon its shared proposal.
create or replace function private.sync_setlist_on_rehearsal_link_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_service record;
  v_source_count integer;
  v_target_count integer;
begin
  if new.id is distinct from old.id then
    raise exception 'Event identity cannot change while checking linked setlists.'
      using errcode = '23514';
  end if;

  if new.org_id is distinct from old.org_id
    and exists (select 1 from public.setlists where event_id = old.id) then
    raise exception 'Cannot change the church of an event with a setlist.'
      using errcode = '23514';
  end if;

  if old.event_type = 'Sunday Service'
    and (new.event_type is distinct from old.event_type
      or new.org_id is distinct from old.org_id)
    and exists (
      select 1 from public.events rehearsal
      where rehearsal.linked_event_id = old.id
        and rehearsal.event_type = 'Rehearsals'
    ) then
    raise exception 'Cannot change a Sunday Service used by a linked rehearsal.'
      using errcode = '23514';
  end if;

  if old.event_type = 'Rehearsals' and old.linked_event_id is not null
    and (new.linked_event_id is distinct from old.linked_event_id
      or new.event_type is distinct from old.event_type)
    and exists (
      select 1 from public.setlists where event_id = old.linked_event_id
    ) then
    raise exception 'Cannot change a rehearsal link while its Sunday Service has a shared setlist.'
      using errcode = '23514';
  end if;

  if new.event_type <> 'Rehearsals' or new.linked_event_id is null then
    return new;
  end if;

  select id, org_id, event_type into v_service
  from public.events where id = new.linked_event_id for update;
  if not found or v_service.event_type <> 'Sunday Service'
    or v_service.org_id is distinct from new.org_id then
    raise exception 'Linked rehearsal must point to a Sunday Service in the same church.'
      using errcode = '23514';
  end if;

  -- Only the transition into a new pair needs to move an existing proposal.
  if old.event_type = 'Rehearsals'
    and old.linked_event_id is not distinct from new.linked_event_id then
    return new;
  end if;

  select count(*) into v_source_count
  from public.setlists where event_id = old.id;
  select count(*) into v_target_count
  from public.setlists where event_id = v_service.id;

  if v_source_count > 1 or v_target_count > 1
    or (v_source_count > 0 and v_target_count > 0) then
    raise exception 'Link would combine or hide existing setlists; resolve proposals first.'
      using errcode = '23505';
  end if;

  if v_source_count = 1 then
    update public.setlists
    set event_id = v_service.id
    where event_id = old.id;
  end if;

  return new;
end;
$$;

revoke all on function private.sync_setlist_on_rehearsal_link_change()
  from public, anon, authenticated;
create trigger trg_sync_setlist_on_rehearsal_link_change
  before update of linked_event_id, event_type, org_id on public.events
  for each row execute function private.sync_setlist_on_rehearsal_link_change();

-- Preserve the current leadership check and include Song Leaders assigned to
-- the linked rehearsal after its proposal moves to the service event.
create or replace function public.can_access_setlist_revision_discussion(p_setlist_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.setlists s
    where s.id = p_setlist_id
      and s.org_id = public.auth_org_id()
      and (
        exists (
          select 1
          from public.user_roles ur
          join public.roles r on r.id = ur.role_id
          where ur.user_id = (select auth.uid())
            and ur.org_id = s.org_id
            and r.name in (
              'Admin', 'Production Director', 'Music Director',
              'Stage Director', 'Admin Coordinator', 'Setlist Coordinator'
            )
        )
        or exists (
          select 1
          from public.event_assignments ea
          join public.roles r on r.id = ea.role_id
          where ea.event_id = s.event_id
            and ea.user_id = (select auth.uid())
            and ea.org_id = s.org_id
            and r.name = 'Song Leader'
        )
        or exists (
          select 1
          from public.event_assignments ea
          join public.roles r on r.id = ea.role_id
          join public.events rehearsal on rehearsal.id = ea.event_id
          join public.events service on service.id = rehearsal.linked_event_id
          where service.id = s.event_id
            and service.event_type = 'Sunday Service'
            and service.org_id = s.org_id
            and rehearsal.event_type = 'Rehearsals'
            and rehearsal.org_id = s.org_id
            and ea.user_id = (select auth.uid())
            and ea.org_id = s.org_id
            and r.name = 'Song Leader'
        )
      )
  );
$$;

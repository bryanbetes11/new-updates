-- Keep the event editor's song_leader_id and the Team Members Song Leader
-- assignment in sync. Team assignments are authoritative for existing data,
-- while edits to song_leader_id replace the corresponding assignment.
create or replace function private.sync_event_song_leader_from_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_is_song_leader boolean := false;
  v_new_is_song_leader boolean := false;
begin
  if tg_op <> 'INSERT' then
    select role.name = 'Song Leader'
    into v_old_is_song_leader
    from public.roles role
    where role.id = old.role_id;
  end if;

  if tg_op <> 'DELETE' then
    select role.name = 'Song Leader'
    into v_new_is_song_leader
    from public.roles role
    where role.id = new.role_id;
  end if;

  if tg_op <> 'INSERT' and coalesce(v_old_is_song_leader, false)
     and (tg_op = 'DELETE' or not coalesce(v_new_is_song_leader, false)) then
    update public.events event
    set song_leader_id = null
    where event.id = old.event_id
      and event.org_id = old.org_id
      and event.song_leader_id = old.user_id;
  end if;

  if tg_op <> 'DELETE' and coalesce(v_new_is_song_leader, false) then
    update public.events event
    set song_leader_id = new.user_id
    where event.id = new.event_id
      and event.org_id = new.org_id
      and event.song_leader_id is distinct from new.user_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function private.sync_song_leader_assignment_from_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_song_leader_role_id uuid;
begin
  select role.id
  into v_song_leader_role_id
  from public.roles role
  where role.name = 'Song Leader'
  order by role.id
  limit 1;

  if v_song_leader_role_id is null then
    return new;
  end if;

  delete from public.event_assignments assignment
  where assignment.event_id = new.id
    and assignment.org_id = new.org_id
    and assignment.role_id = v_song_leader_role_id
    and (new.song_leader_id is null or assignment.user_id <> new.song_leader_id);

  if new.song_leader_id is not null then
    insert into public.event_assignments (event_id, user_id, role_id, org_id)
    values (new.id, new.song_leader_id, v_song_leader_role_id, new.org_id)
    on conflict (event_id, user_id, role_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_event_song_leader_from_assignment
  on public.event_assignments;
create trigger trg_sync_event_song_leader_from_assignment
after insert or delete or update of user_id, role_id
on public.event_assignments
for each row
execute function private.sync_event_song_leader_from_assignment();

drop trigger if exists trg_sync_song_leader_assignment_from_event
  on public.events;
create trigger trg_sync_song_leader_assignment_from_event
after update of song_leader_id
on public.events
for each row
when (old.song_leader_id is distinct from new.song_leader_id)
execute function private.sync_song_leader_assignment_from_event();

-- Repair stale event fields using the current Team Members assignment.
update public.events event
set song_leader_id = assignment.user_id
from public.event_assignments assignment
join public.roles role on role.id = assignment.role_id
where assignment.event_id = event.id
  and assignment.org_id = event.org_id
  and role.name = 'Song Leader'
  and event.song_leader_id is distinct from assignment.user_id;

revoke all on function private.sync_event_song_leader_from_assignment()
  from public, anon, authenticated;
revoke all on function private.sync_song_leader_assignment_from_event()
  from public, anon, authenticated;

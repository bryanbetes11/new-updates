-- Extend Song Leader synchronization to keep the generated event title aligned
-- with Team Members, and repair events orphaned before synchronization existed.
create or replace function private.sync_event_song_leader_from_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_is_song_leader boolean := false;
  v_new_is_song_leader boolean := false;
  v_leader_title text;
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
    set song_leader_id = null,
        title = event.event_type
    where event.id = old.event_id
      and event.org_id = old.org_id
      and event.song_leader_id = old.user_id;
  end if;

  if tg_op <> 'DELETE' and coalesce(v_new_is_song_leader, false) then
    select concat_ws(
      ' ',
      case profile.gender
        when 'male' then 'Bro.'
        when 'female' then 'Sis.'
        else null
      end,
      profile.first_name
    )
    into v_leader_title
    from public.profiles profile
    where profile.id = new.user_id;

    update public.events event
    set song_leader_id = new.user_id,
        title = coalesce(nullif(v_leader_title, ''), event.event_type)
    where event.id = new.event_id
      and event.org_id = new.org_id
      and (
        event.song_leader_id is distinct from new.user_id
        or event.title is distinct from coalesce(nullif(v_leader_title, ''), event.event_type)
      );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

update public.events event
set song_leader_id = null,
    title = event.event_type
where event.song_leader_id is not null
  and not exists (
    select 1
    from public.event_assignments assignment
    join public.roles role on role.id = assignment.role_id
    where assignment.event_id = event.id
      and assignment.org_id = event.org_id
      and role.name = 'Song Leader'
  );

revoke all on function private.sync_event_song_leader_from_assignment()
  from public, anon, authenticated;

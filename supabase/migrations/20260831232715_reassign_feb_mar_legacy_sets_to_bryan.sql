-- Reassign two legacy Song Leader events that were created through the old
-- Admin Dev testing account to Bryan's current member account.
do $$
declare
  v_bryan_id uuid;
  v_song_leader_role_id uuid;
begin
  select profile.id
  into v_bryan_id
  from public.profiles profile
  where lower(profile.email) = 'fwd.bryanashleybetes@gmail.com'
    and profile.first_name = 'Bryan'
    and profile.last_name = 'Betes'
  limit 1;

  select role.id
  into v_song_leader_role_id
  from public.roles role
  where role.name = 'Song Leader'
  order by role.id
  limit 1;

  if v_bryan_id is null or v_song_leader_role_id is null then
    raise exception 'Bryan profile or Song Leader role was not found';
  end if;

  update public.events event
  set song_leader_id = v_bryan_id
  where event.id in (
    '6a472053-01dc-4fe1-b6e5-d804904170cd'::uuid,
    'e131113c-6bb8-4c54-bb29-36af77347ec3'::uuid
  )
    and event.event_date in ('2026-02-08'::date, '2026-03-22'::date);

  update public.event_assignments assignment
  set status = 'confirmed',
      confirmed_at = coalesce(assignment.confirmed_at, now()),
      decline_reason = null
  where assignment.event_id in (
    '6a472053-01dc-4fe1-b6e5-d804904170cd'::uuid,
    'e131113c-6bb8-4c54-bb29-36af77347ec3'::uuid
  )
    and assignment.user_id = v_bryan_id
    and assignment.role_id = v_song_leader_role_id;
end;
$$;

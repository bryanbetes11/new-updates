-- Reassignment is not confirmation. Keep the corrected historical ownership,
-- but require Bryan to respond to the Song Leader assignments normally.
update public.event_assignments assignment
set status = 'pending',
    confirmed_at = null,
    decline_reason = null
where assignment.event_id in (
  '6a472053-01dc-4fe1-b6e5-d804904170cd'::uuid,
  'e131113c-6bb8-4c54-bb29-36af77347ec3'::uuid
)
  and assignment.user_id = (
    select profile.id
    from public.profiles profile
    where lower(profile.email) = 'fwd.bryanashleybetes@gmail.com'
      and profile.first_name = 'Bryan'
      and profile.last_name = 'Betes'
    limit 1
  )
  and assignment.role_id = (
    select role.id
    from public.roles role
    where role.name = 'Song Leader'
    order by role.id
    limit 1
  );

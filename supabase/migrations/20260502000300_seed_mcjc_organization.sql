-- ============================================================================
-- Seed MCJC as the first tenant organization
-- ----------------------------------------------------------------------------
-- MCJC is preserved as the existing live tenant and is exempt from billing
-- during rollout, so no subscription fields are populated here.
-- ============================================================================

do $$
declare
  v_admin_user_id uuid;
begin
  select id
  into v_admin_user_id
  from public.profiles
  where lower(email) = 'bryanbetes11@gmail.com'
  order by created_at
  limit 1;

  insert into public.organizations (
    name,
    slug,
    created_by
  )
  values (
    'MCJC Church',
    'mcjc-church',
    v_admin_user_id
  )
  on conflict (slug) do update
  set
    name = excluded.name,
    created_by = coalesce(public.organizations.created_by, excluded.created_by);

  update public.profiles
  set is_org_admin = true
  where lower(email) = 'bryanbetes11@gmail.com';
end $$;

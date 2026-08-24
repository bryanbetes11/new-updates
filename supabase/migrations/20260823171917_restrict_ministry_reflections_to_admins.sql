-- Ministry Reflections contain sensitive pastoral feedback. Keep the existing
-- helper name for backwards-compatible function and policy calls, but make its
-- authorization rule explicit: organization administrators, the platform owner,
-- and members with the Admin role only.
create or replace function private.is_production_director(
  p_org_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.org_id = p_org_id
      and (
        p.is_org_admin = true
        or public.is_platform_owner()
        or exists (
          select 1
          from public.user_roles ur
          join public.roles r on r.id = ur.role_id
          where ur.user_id = p_user_id
            and r.name = 'Admin'
        )
      )
  );
$$;

revoke all on function private.is_production_director(uuid, uuid) from public, anon;
grant execute on function private.is_production_director(uuid, uuid) to authenticated, service_role;

-- ============================================================================
-- Multi-tenant auth helper functions
-- ----------------------------------------------------------------------------
-- These helpers centralize tenant-aware auth checks so upcoming RLS rewrites
-- are consistent and avoid repeating the same joins in every policy.
-- ============================================================================

create or replace function public.auth_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.org_id
  from public.profiles p
  where p.id = (select auth.uid())
  limit 1;
$$;

create or replace function public.auth_is_org_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.org_id is not null
      and p.is_org_admin = true
  );
$$;

create or replace function public.auth_is_org_leader()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid())
      and ur.org_id = public.auth_org_id()
      and r.is_leadership = true
  );
$$;

comment on function public.auth_org_id() is
  'Returns the current authenticated user org_id for multi-tenant RLS checks.';
comment on function public.auth_is_org_admin() is
  'Returns true when the current authenticated user is a tenant admin.';
comment on function public.auth_is_org_leader() is
  'Returns true when the current authenticated user holds a leadership role in their tenant.';

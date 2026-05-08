-- ============================================================================
-- Multi-tenant RLS Batch 1: identity and events
-- ----------------------------------------------------------------------------
-- Scope:
--   * profiles
--   * user_roles
--   * events
--   * event_assignments
--
-- This migration also adds insert-time org_id autofill triggers so existing app
-- writes continue to work before all frontend create/update paths are made
-- org-aware explicitly.
-- ============================================================================

-- ---- org_id autofill triggers -----------------------------------------------

create or replace function public.autofill_profile_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is null then
    new.org_id := public.auth_org_id();
  end if;
  return new;
end;
$$;

create or replace function public.autofill_user_role_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is null then
    select p.org_id
    into new.org_id
    from public.profiles p
    where p.id = new.user_id;

    if new.org_id is null then
      new.org_id := public.auth_org_id();
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.autofill_event_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is null then
    select p.org_id
    into new.org_id
    from public.profiles p
    where p.id = new.created_by;

    if new.org_id is null then
      new.org_id := public.auth_org_id();
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.autofill_event_assignment_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is null then
    select e.org_id
    into new.org_id
    from public.events e
    where e.id = new.event_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_autofill_org_id on public.profiles;
create trigger trg_profiles_autofill_org_id
  before insert on public.profiles
  for each row execute function public.autofill_profile_org_id();

drop trigger if exists trg_user_roles_autofill_org_id on public.user_roles;
create trigger trg_user_roles_autofill_org_id
  before insert on public.user_roles
  for each row execute function public.autofill_user_role_org_id();

drop trigger if exists trg_events_autofill_org_id on public.events;
create trigger trg_events_autofill_org_id
  before insert on public.events
  for each row execute function public.autofill_event_org_id();

drop trigger if exists trg_event_assignments_autofill_org_id on public.event_assignments;
create trigger trg_event_assignments_autofill_org_id
  before insert on public.event_assignments
  for each row execute function public.autofill_event_assignment_org_id();

-- ---- helper predicate for privileged same-org profile management ------------

create or replace function public.auth_can_manage_org_profiles()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.auth_is_org_admin()
    or exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = (select auth.uid())
        and ur.org_id = public.auth_org_id()
        and r.name in ('Admin', 'Admin Coordinator', 'Production Director')
    );
$$;

comment on function public.auth_can_manage_org_profiles() is
  'Returns true when the current authenticated user can manage member profiles in their tenant.';

-- ---- profiles policies ------------------------------------------------------

drop policy if exists "Authenticated users can view all profiles" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Admin Coordinator and Production Director can update any profile" on public.profiles;
drop policy if exists "Admin Coordinator and Production Director can update any profil" on public.profiles;

create policy "Users can view same-org profiles"
  on public.profiles for select
  to authenticated
  using (
    id = (select auth.uid())
    or org_id = public.auth_org_id()
  );

create policy "Users can insert own profile in current org"
  on public.profiles for insert
  to authenticated
  with check (
    id = (select auth.uid())
    and (org_id is null or org_id = public.auth_org_id())
  );

create policy "Users can update own profile in current org"
  on public.profiles for update
  to authenticated
  using (
    id = (select auth.uid())
    and (org_id = public.auth_org_id() or org_id is null)
  )
  with check (
    id = (select auth.uid())
    and (org_id = public.auth_org_id() or org_id is null)
  );

create policy "Org managers can update same-org profiles"
  on public.profiles for update
  to authenticated
  using (
    org_id = public.auth_org_id()
    and public.auth_can_manage_org_profiles()
  )
  with check (
    org_id = public.auth_org_id()
    and public.auth_can_manage_org_profiles()
  );

-- ---- user_roles policies ----------------------------------------------------

drop policy if exists "Authenticated users can view user roles" on public.user_roles;
drop policy if exists "Users can insert their own roles" on public.user_roles;
drop policy if exists "Users can delete their own roles" on public.user_roles;

create policy "Users can view same-org user roles"
  on public.user_roles for select
  to authenticated
  using (
    org_id = public.auth_org_id()
  );

create policy "Users can insert own roles in current org"
  on public.user_roles for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  );

create policy "Org leaders can manage same-org user roles"
  on public.user_roles for insert
  to authenticated
  with check (
    org_id = public.auth_org_id()
    and public.auth_is_org_leader()
  );

create policy "Users can delete own roles in current org"
  on public.user_roles for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  );

create policy "Org leaders can delete same-org user roles"
  on public.user_roles for delete
  to authenticated
  using (
    org_id = public.auth_org_id()
    and public.auth_is_org_leader()
  );

-- ---- events policies --------------------------------------------------------

drop policy if exists "Authenticated users can view events" on public.events;
drop policy if exists "Authenticated users can create events" on public.events;
drop policy if exists "Event creator can update events" on public.events;
drop policy if exists "Leadership can update events" on public.events;
drop policy if exists "Event creator can delete events" on public.events;

create policy "Users can view same-org events"
  on public.events for select
  to authenticated
  using (
    org_id = public.auth_org_id()
  );

create policy "Users can create events in current org"
  on public.events for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and org_id = public.auth_org_id()
  );

create policy "Event creators can update same-org events"
  on public.events for update
  to authenticated
  using (
    created_by = (select auth.uid())
    and org_id = public.auth_org_id()
  )
  with check (
    org_id = public.auth_org_id()
  );

create policy "Org leaders can update same-org events"
  on public.events for update
  to authenticated
  using (
    org_id = public.auth_org_id()
    and (
      public.auth_is_org_admin()
      or exists (
        select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = (select auth.uid())
          and ur.org_id = public.auth_org_id()
          and r.name in (
            'Admin',
            'Admin Coordinator',
            'Music Director',
            'Stage Director',
            'Production Director',
            'Setlist Coordinator'
          )
      )
    )
  )
  with check (
    org_id = public.auth_org_id()
  );

create policy "Event creators can delete same-org events"
  on public.events for delete
  to authenticated
  using (
    created_by = (select auth.uid())
    and org_id = public.auth_org_id()
  );

-- ---- event_assignments policies --------------------------------------------

drop policy if exists "Authenticated users can view assignments" on public.event_assignments;
drop policy if exists "Authenticated users can create assignments" on public.event_assignments;
drop policy if exists "Assigned user can update their assignment" on public.event_assignments;
drop policy if exists "Authenticated users can delete assignments" on public.event_assignments;

create policy "Users can view same-org assignments"
  on public.event_assignments for select
  to authenticated
  using (
    org_id = public.auth_org_id()
  );

create policy "Org leaders can create same-org assignments"
  on public.event_assignments for insert
  to authenticated
  with check (
    org_id = public.auth_org_id()
    and public.auth_is_org_leader()
  );

create policy "Assigned users can update own same-org assignment"
  on public.event_assignments for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  )
  with check (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  );

create policy "Org leaders can delete same-org assignments"
  on public.event_assignments for delete
  to authenticated
  using (
    org_id = public.auth_org_id()
    and public.auth_is_org_leader()
  );

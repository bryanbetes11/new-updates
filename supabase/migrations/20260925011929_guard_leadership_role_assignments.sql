-- Ministry roles affect app behavior, so members cannot grant any role to
-- themselves. Church profile managers maintain ordinary roles; church admins
-- alone grant or remove leadership roles.
drop policy if exists "Users can insert own roles in current org" on public.user_roles;
drop policy if exists "Users can delete own roles in current org" on public.user_roles;
drop policy if exists "Org leaders can manage same-org user roles" on public.user_roles;
drop policy if exists "Org leaders can delete same-org user roles" on public.user_roles;

create policy "Profile managers can add same-org non-leadership roles"
  on public.user_roles for insert to authenticated
  with check (
    org_id = (select public.auth_org_id())
    and (select public.auth_can_manage_org_profiles())
    and exists (
      select 1 from public.profiles p
      where p.id = user_id and p.org_id = (select public.auth_org_id())
    )
    and exists (
      select 1 from public.roles r
      where r.id = role_id and not r.is_leadership
    )
  );

create policy "Profile managers can remove same-org non-leadership roles"
  on public.user_roles for delete to authenticated
  using (
    org_id = (select public.auth_org_id())
    and (select public.auth_can_manage_org_profiles())
    and exists (
      select 1 from public.roles r
      where r.id = role_id and not r.is_leadership
    )
  );

create policy "Church admins can add same-org leadership roles"
  on public.user_roles for insert to authenticated
  with check (
    org_id = (select public.auth_org_id())
    and (select public.auth_is_org_admin())
    and exists (
      select 1 from public.profiles p
      where p.id = user_id and p.org_id = (select public.auth_org_id())
    )
    and exists (
      select 1 from public.roles r
      where r.id = role_id and r.is_leadership
    )
  );

create policy "Church admins can remove same-org leadership roles"
  on public.user_roles for delete to authenticated
  using (
    org_id = (select public.auth_org_id())
    and (select public.auth_is_org_admin())
    and exists (
      select 1 from public.roles r
      where r.id = role_id and r.is_leadership
    )
  );

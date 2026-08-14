drop policy if exists "Church admins can view own church activity logs" on public.activity_logs;

create policy "Church administrators can view own church activity logs"
on public.activity_logs for select to authenticated
using (
  org_id = public.auth_org_id()
  and (
    public.auth_is_org_admin()
    or public.is_platform_owner()
    or exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = (select auth.uid())
        and ur.org_id = public.auth_org_id()
        and r.name = 'Admin'
    )
  )
);

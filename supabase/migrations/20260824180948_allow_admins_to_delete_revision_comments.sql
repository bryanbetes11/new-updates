drop policy if exists "Admins can delete setlist revision comments"
  on public.setlist_revision_comments;

create policy "Admins can delete setlist revision comments"
  on public.setlist_revision_comments for delete
  to authenticated
  using (
    org_id = (select public.auth_org_id())
    and (
      coalesce((select public.auth_is_org_admin()), false)
      or coalesce((select public.is_platform_owner()), false)
      or exists (
        select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = (select auth.uid())
          and ur.org_id = setlist_revision_comments.org_id
          and r.name = 'Admin'
      )
    )
  );

comment on policy "Admins can delete setlist revision comments"
  on public.setlist_revision_comments is
  'Allows tenant admins, members with the Admin role, and platform owners to moderate revision discussions.';

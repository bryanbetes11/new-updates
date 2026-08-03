-- The event detail UI allows organization leaders to delete events, but the
-- existing RLS policy only permits the original creator. Keep creator access
-- while granting the same tenant-scoped permission to recognized leaders.

drop policy if exists "Event creators can delete same-org events" on public.events;
drop policy if exists "Event creators and org leaders can delete same-org events" on public.events;

create policy "Event creators and org leaders can delete same-org events"
  on public.events for delete
  to authenticated
  using (
    org_id = (select public.auth_org_id())
    and (
      created_by = (select auth.uid())
      or (select public.auth_is_org_leader())
    )
  );

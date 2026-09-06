create table public.setlist_revision_discussion_views (
  org_id uuid not null references public.organizations(id) on delete cascade,
  setlist_id uuid not null references public.setlists(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (setlist_id, user_id)
);

comment on table public.setlist_revision_discussion_views is
  'Immutable first-seen receipts for setlist revision discussion cards.';

create index setlist_revision_discussion_views_setlist_id_idx
  on public.setlist_revision_discussion_views (setlist_id, viewed_at desc);

create index setlist_revision_discussion_views_user_id_idx
  on public.setlist_revision_discussion_views (user_id);

alter table public.setlist_revision_discussion_views enable row level security;

create policy "Same-org members can view revision discussion views"
  on public.setlist_revision_discussion_views
  for select
  to authenticated
  using (
    org_id = (select public.auth_org_id())
    and exists (
      select 1
      from public.setlists setlist
      where setlist.id = setlist_revision_discussion_views.setlist_id
        and setlist.org_id = setlist_revision_discussion_views.org_id
    )
  );

create policy "Users can record own revision discussion view"
  on public.setlist_revision_discussion_views
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and org_id = (select public.auth_org_id())
    and exists (
      select 1
      from public.setlists setlist
      where setlist.id = setlist_revision_discussion_views.setlist_id
        and setlist.org_id = setlist_revision_discussion_views.org_id
        and public.can_access_setlist_revision_discussion(setlist.id)
    )
  );

revoke all privileges on table public.setlist_revision_discussion_views
  from public, anon, authenticated;
grant select, insert on table public.setlist_revision_discussion_views to authenticated;

create or replace function public.record_setlist_revision_discussion_view(
  p_setlist_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid := public.auth_org_id();
begin
  if v_user_id is null or v_org_id is null then
    raise exception 'Authentication and organization membership are required'
      using errcode = '42501';
  end if;

  if not public.can_access_setlist_revision_discussion(p_setlist_id) then
    raise exception 'Setlist not found or inaccessible'
      using errcode = '42501';
  end if;

  insert into public.setlist_revision_discussion_views (
    org_id,
    setlist_id,
    user_id
  )
  values (
    v_org_id,
    p_setlist_id,
    v_user_id
  )
  on conflict (setlist_id, user_id) do nothing;

  return found;
end;
$$;

comment on function public.record_setlist_revision_discussion_view(uuid) is
  'Records one first-seen receipt for a same-organization setlist revision discussion.';

revoke all on function public.record_setlist_revision_discussion_view(uuid)
  from public, anon;
grant execute on function public.record_setlist_revision_discussion_view(uuid)
  to authenticated;

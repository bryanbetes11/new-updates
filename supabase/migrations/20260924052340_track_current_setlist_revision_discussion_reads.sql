-- Keep the original first view, but also record a server-timestamped read after
-- each later review decision or comment. Existing receipts retain their actual
-- first-view time instead of appearing to have seen today's discussion.
alter table public.setlist_revision_discussion_views
  add column last_viewed_at timestamptz not null default now();

update public.setlist_revision_discussion_views
set last_viewed_at = viewed_at;

alter table public.setlist_revision_discussion_views
  add constraint setlist_revision_discussion_views_read_order
  check (last_viewed_at >= viewed_at);

comment on table public.setlist_revision_discussion_views is
  'First and latest server-recorded reads of a setlist revision discussion.';

-- All receipt writes go through checked RPCs. In particular, clients cannot
-- submit their own viewed_at or last_viewed_at values through the Data API.
revoke insert, update on public.setlist_revision_discussion_views
  from public, anon, authenticated;

drop policy if exists "Users can record own revision discussion view"
  on public.setlist_revision_discussion_views;

-- Keep the old RPC callable for installed clients. It still records only a
-- first view; the current client uses the new read RPC below.
create or replace function public.record_setlist_revision_discussion_view(
  p_setlist_id uuid
)
returns boolean
language plpgsql
security definer
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

  insert into public.setlist_revision_discussion_views (org_id, setlist_id, user_id)
  values (v_org_id, p_setlist_id, v_user_id)
  on conflict (setlist_id, user_id) do nothing;

  return found;
end;
$$;

create function public.record_setlist_revision_discussion_read(
  p_setlist_id uuid
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid := public.auth_org_id();
  v_read_at timestamptz := clock_timestamp();
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
    org_id, setlist_id, user_id, viewed_at, last_viewed_at
  )
  values (v_org_id, p_setlist_id, v_user_id, v_read_at, v_read_at)
  on conflict (setlist_id, user_id) do update
    set last_viewed_at = greatest(
      public.setlist_revision_discussion_views.last_viewed_at,
      excluded.last_viewed_at
    )
  returning last_viewed_at into v_read_at;

  return v_read_at;
end;
$$;

comment on function public.record_setlist_revision_discussion_read(uuid) is
  'Records the current signed-in participant read time using the database clock.';

revoke all on function public.record_setlist_revision_discussion_view(uuid)
  from public, anon, authenticated;
grant execute on function public.record_setlist_revision_discussion_view(uuid)
  to authenticated;

revoke all on function public.record_setlist_revision_discussion_read(uuid)
  from public, anon, authenticated;
grant execute on function public.record_setlist_revision_discussion_read(uuid)
  to authenticated;

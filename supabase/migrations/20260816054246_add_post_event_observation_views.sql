create table public.post_event_observation_views (
  org_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  observation_id uuid not null references public.post_event_observations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (observation_id, user_id)
);

comment on table public.post_event_observation_views is
  'Immutable first-seen receipts for post-event observation cards. Observation authors are excluded.';

create index post_event_observation_views_user_idx
  on public.post_event_observation_views (user_id);

create index post_event_observation_views_org_event_idx
  on public.post_event_observation_views (org_id, event_id, observation_id, viewed_at desc);

alter table public.post_event_observation_views enable row level security;

create policy "Same-org members can view observation viewers"
  on public.post_event_observation_views
  for select
  to authenticated
  using (
    org_id = (select public.auth_org_id())
    and exists (
      select 1
      from public.post_event_observations observation
      where observation.id = post_event_observation_views.observation_id
        and observation.org_id = post_event_observation_views.org_id
        and observation.event_id = post_event_observation_views.event_id
    )
  );

create policy "Users can record own observation views"
  on public.post_event_observation_views
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and org_id = (select public.auth_org_id())
    and exists (
      select 1
      from public.post_event_observations observation
      where observation.id = post_event_observation_views.observation_id
        and observation.org_id = post_event_observation_views.org_id
        and observation.event_id = post_event_observation_views.event_id
        and observation.author_id <> (select auth.uid())
    )
  );

revoke all privileges on table public.post_event_observation_views
  from public, anon, authenticated;
grant select, insert
  on table public.post_event_observation_views
  to authenticated;

create or replace function public.record_post_event_observation_view(
  p_observation_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid := public.auth_org_id();
  v_event_id uuid;
  v_author_id uuid;
  v_inserted_count integer := 0;
begin
  if v_user_id is null or v_org_id is null then
    raise exception 'Authentication and organization membership are required'
      using errcode = '42501';
  end if;

  select observation.event_id, observation.author_id
    into v_event_id, v_author_id
  from public.post_event_observations observation
  where observation.id = p_observation_id
    and observation.org_id = v_org_id;

  if not found then
    raise exception 'Observation not found or inaccessible'
      using errcode = '42501';
  end if;

  if v_author_id = v_user_id then
    return false;
  end if;

  insert into public.post_event_observation_views (
    org_id,
    event_id,
    observation_id,
    user_id
  )
  values (
    v_org_id,
    v_event_id,
    p_observation_id,
    v_user_id
  )
  on conflict (observation_id, user_id) do nothing;

  get diagnostics v_inserted_count = row_count;
  return v_inserted_count = 1;
end;
$$;

comment on function public.record_post_event_observation_view(uuid) is
  'Records one first-seen receipt for a same-organization observation, excluding its author.';

revoke all on function public.record_post_event_observation_view(uuid)
  from public, anon;
grant execute on function public.record_post_event_observation_view(uuid)
  to authenticated;

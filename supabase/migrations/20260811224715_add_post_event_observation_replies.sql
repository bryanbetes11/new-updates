create table if not exists public.post_event_observation_replies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  observation_id uuid not null references public.post_event_observations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists post_event_observation_replies_observation_created_idx
  on public.post_event_observation_replies (observation_id, created_at);
create index if not exists post_event_observation_replies_event_created_idx
  on public.post_event_observation_replies (event_id, created_at);

create or replace function public.prepare_post_event_observation_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event_id uuid;
  target_org_id uuid;
begin
  select observation.event_id, observation.org_id
    into target_event_id, target_org_id
  from public.post_event_observations observation
  where observation.id = new.observation_id;

  if target_event_id is null then
    raise exception 'Observation not found';
  end if;

  if new.event_id <> target_event_id then
    raise exception 'Reply must belong to the observation event';
  end if;

  new.event_id := target_event_id;
  new.org_id := target_org_id;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.prepare_post_event_observation_reply() from public;

drop trigger if exists trg_prepare_post_event_observation_reply on public.post_event_observation_replies;
create trigger trg_prepare_post_event_observation_reply
  before insert or update on public.post_event_observation_replies
  for each row execute function public.prepare_post_event_observation_reply();

alter table public.post_event_observation_replies enable row level security;

create policy "Same-org members can view observation replies"
  on public.post_event_observation_replies for select
  to authenticated
  using (org_id = public.auth_org_id());

create policy "Same-org members can create observation replies"
  on public.post_event_observation_replies for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and org_id = public.auth_org_id()
  );

create policy "Authors can update observation replies"
  on public.post_event_observation_replies for update
  to authenticated
  using (user_id = (select auth.uid()) and org_id = public.auth_org_id())
  with check (user_id = (select auth.uid()) and org_id = public.auth_org_id());

create policy "Authors and leaders can delete observation replies"
  on public.post_event_observation_replies for delete
  to authenticated
  using (
    org_id = public.auth_org_id()
    and (
      user_id = (select auth.uid())
      or public.auth_is_org_admin()
      or public.auth_is_org_leader()
    )
  );

grant select, insert, update, delete on public.post_event_observation_replies to authenticated;

comment on table public.post_event_observation_replies is
  'Compact threaded replies attached to post-event observations.';

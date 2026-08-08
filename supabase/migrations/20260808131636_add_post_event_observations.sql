-- Post-event improvement log for sound, instruments, lighting, service flow,
-- team coordination, and other operational observations.

create table public.post_event_observations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  category text not null
    check (category in ('sound', 'instruments', 'lighting', 'service_flow', 'team', 'other')),
  observation text not null
    check (char_length(btrim(observation)) between 1 and 2000),
  status text not null default 'open'
    check (status in ('open', 'monitoring', 'resolved')),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint post_event_observations_resolution_check check (
    (status = 'resolved' and resolved_at is not null and resolved_by is not null)
    or (status <> 'resolved' and resolved_at is null and resolved_by is null)
  )
);

create index post_event_observations_event_created_idx
  on public.post_event_observations (event_id, created_at desc);

create index post_event_observations_org_status_idx
  on public.post_event_observations (org_id, status);

create or replace function public.autofill_post_event_observation_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select e.org_id
  into new.org_id
  from public.events e
  where e.id = new.event_id;

  return new;
end;
$$;

revoke all on function public.autofill_post_event_observation_org_id() from public;

create trigger trg_post_event_observations_autofill_org_id
  before insert on public.post_event_observations
  for each row execute function public.autofill_post_event_observation_org_id();

create trigger trg_post_event_observations_touch_updated_at
  before update on public.post_event_observations
  for each row execute function public.touch_updated_at();

alter table public.post_event_observations enable row level security;

create policy "Users can view same-org post-event observations"
  on public.post_event_observations for select
  to authenticated
  using (
    org_id = public.auth_org_id()
    and exists (
      select 1
      from public.events e
      where e.id = post_event_observations.event_id
        and e.org_id = public.auth_org_id()
    )
  );

create policy "Users can create same-org post-event observations"
  on public.post_event_observations for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and org_id = public.auth_org_id()
    and status = 'open'
    and resolved_at is null
    and resolved_by is null
    and exists (
      select 1
      from public.events e
      where e.id = post_event_observations.event_id
        and e.org_id = public.auth_org_id()
    )
  );

create policy "Authors and leaders can update post-event observations"
  on public.post_event_observations for update
  to authenticated
  using (
    org_id = public.auth_org_id()
    and (
      (author_id = (select auth.uid()) and status = 'open')
      or public.auth_is_org_admin()
      or public.auth_is_org_leader()
    )
  )
  with check (
    org_id = public.auth_org_id()
    and (
      (
        author_id = (select auth.uid())
        and status = 'open'
        and resolved_at is null
        and resolved_by is null
      )
      or public.auth_is_org_admin()
      or public.auth_is_org_leader()
    )
  );

create policy "Authors and leaders can delete post-event observations"
  on public.post_event_observations for delete
  to authenticated
  using (
    org_id = public.auth_org_id()
    and (
      author_id = (select auth.uid())
      or public.auth_is_org_admin()
      or public.auth_is_org_leader()
    )
  );

grant select, insert, update, delete on table public.post_event_observations to authenticated;

comment on table public.post_event_observations is
  'Team observations and follow-up status captured after an event.';

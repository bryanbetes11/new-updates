create table if not exists public.event_song_preparation (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  rehearsal_event_id uuid references public.events(id) on delete set null,
  setlist_song_id uuid not null references public.setlist_songs(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  readiness text not null default 'not_rehearsed'
    check (readiness in ('not_rehearsed', 'needs_work', 'ready')),
  issue_type text
    check (issue_type is null or issue_type in ('timing', 'chords', 'vocals', 'transition', 'lyrics', 'other')),
  note text,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, setlist_song_id)
);

create index if not exists event_song_preparation_event_id_idx
  on public.event_song_preparation (event_id);

create index if not exists event_song_preparation_rehearsal_event_id_idx
  on public.event_song_preparation (rehearsal_event_id)
  where rehearsal_event_id is not null;

alter table public.event_song_preparation enable row level security;

revoke all on table public.event_song_preparation from public, anon;
grant select, insert, update, delete on table public.event_song_preparation to authenticated;

drop policy if exists "Org members can view song preparation" on public.event_song_preparation;
create policy "Org members can view song preparation"
  on public.event_song_preparation for select to authenticated
  using (org_id = public.auth_org_id());

drop policy if exists "Org admins can create song preparation" on public.event_song_preparation;
create policy "Org admins can create song preparation"
  on public.event_song_preparation for insert to authenticated
  with check (
    org_id = public.auth_org_id()
    and updated_by = (select auth.uid())
    and public.auth_is_org_admin()
  );

drop policy if exists "Org admins can update song preparation" on public.event_song_preparation;
create policy "Org admins can update song preparation"
  on public.event_song_preparation for update to authenticated
  using (org_id = public.auth_org_id() and public.auth_is_org_admin())
  with check (
    org_id = public.auth_org_id()
    and updated_by = (select auth.uid())
    and public.auth_is_org_admin()
  );

drop policy if exists "Org admins can delete song preparation" on public.event_song_preparation;
create policy "Org admins can delete song preparation"
  on public.event_song_preparation for delete to authenticated
  using (org_id = public.auth_org_id() and public.auth_is_org_admin());

create or replace function public.set_event_song_preparation_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_event_song_preparation_updated_at() from public, anon, authenticated;

drop trigger if exists set_event_song_preparation_updated_at on public.event_song_preparation;
create trigger set_event_song_preparation_updated_at
before update on public.event_song_preparation
for each row execute function public.set_event_song_preparation_updated_at();

comment on table public.event_song_preparation is
  'Admin-pilot rehearsal decisions shared with the linked Service Mode chart flow.';

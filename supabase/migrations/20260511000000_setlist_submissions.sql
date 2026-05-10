-- Stores the result of each theological setlist check
create table if not exists public.setlist_submissions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  setlist_id    uuid not null references public.setlists(id) on delete cascade,
  theme         text not null default '',
  songs         jsonb not null default '[]',
  report        jsonb not null,
  verdict       text not null check (verdict in ('APPROVE', 'REVISE', 'REJECT')),
  rating        numeric(3,1) not null,
  submitted_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.setlist_submissions enable row level security;

-- Members can read submissions for setlists they can see
create policy "members can read own org submissions"
  on public.setlist_submissions for select
  using (
    exists (
      select 1 from public.setlists sl
      where sl.id = setlist_submissions.setlist_id
        and sl.org_id = public.auth_org_id()
    )
  );

-- Members can insert their own submissions
create policy "members can insert own submissions"
  on public.setlist_submissions for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.setlists sl
      where sl.id = setlist_submissions.setlist_id
        and sl.org_id = public.auth_org_id()
    )
  );

-- Users can update their own submissions
create policy "users can update own submissions"
  on public.setlist_submissions for update
  using (user_id = auth.uid());

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger setlist_submissions_updated_at
  before update on public.setlist_submissions
  for each row execute function public.set_updated_at();

-- Index for fast lookup by setlist
create index if not exists setlist_submissions_setlist_id_idx
  on public.setlist_submissions(setlist_id);

-- Index for fast lookup by user
create index if not exists setlist_submissions_user_id_idx
  on public.setlist_submissions(user_id);

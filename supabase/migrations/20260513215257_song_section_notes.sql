create table if not exists public.song_section_notes (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  section_key text not null,
  section_label text not null,
  scope text not null default 'team' check (scope = 'team'),
  note text not null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (song_id, section_key, scope)
);

create index if not exists song_section_notes_song_id_idx
  on public.song_section_notes (song_id);

create index if not exists song_section_notes_org_id_idx
  on public.song_section_notes (org_id);

alter table public.song_section_notes enable row level security;

create or replace function public.autofill_song_section_note_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select s.org_id
  into new.org_id
  from public.songs s
  where s.id = new.song_id;

  new.updated_by := auth.uid();
  new.updated_at := now();

  return new;
end;
$$;

drop trigger if exists trg_song_section_notes_autofill_metadata on public.song_section_notes;
create trigger trg_song_section_notes_autofill_metadata
  before insert or update on public.song_section_notes
  for each row execute function public.autofill_song_section_note_metadata();

drop policy if exists "Users can view same-org song section notes" on public.song_section_notes;
create policy "Users can view same-org song section notes"
  on public.song_section_notes for select
  to authenticated
  using (
    org_id = public.auth_org_id()
  );

drop policy if exists "Users can create same-org song section notes" on public.song_section_notes;
create policy "Users can create same-org song section notes"
  on public.song_section_notes for insert
  to authenticated
  with check (
    org_id = public.auth_org_id()
  );

drop policy if exists "Users can update same-org song section notes" on public.song_section_notes;
create policy "Users can update same-org song section notes"
  on public.song_section_notes for update
  to authenticated
  using (
    org_id = public.auth_org_id()
  )
  with check (
    org_id = public.auth_org_id()
  );

drop policy if exists "Users can delete same-org song section notes" on public.song_section_notes;
create policy "Users can delete same-org song section notes"
  on public.song_section_notes for delete
  to authenticated
  using (
    org_id = public.auth_org_id()
  );

grant select, insert, update, delete on public.song_section_notes to authenticated;

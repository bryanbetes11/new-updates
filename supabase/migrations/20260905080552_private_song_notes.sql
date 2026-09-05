-- Separate from team notes so team readers/admins cannot access personal cues.
create table public.private_song_notes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  section_key text not null check (length(section_key) between 1 and 500),
  note text not null check (length(note) <= 20000),
  primary key (user_id, song_id, section_key)
);
create index private_song_notes_song_id_idx on public.private_song_notes(song_id);
alter table public.private_song_notes enable row level security;
revoke all on public.private_song_notes from public, anon, authenticated;
grant select, insert, update on public.private_song_notes to authenticated;

-- Empty text is a deletion tombstone: importing an old device backup must not
-- restore a note already deleted on another device.
create policy "Owners manage private notes for their organization songs"
on public.private_song_notes for all to authenticated
using (
  user_id = (select auth.uid()) and exists (
    select 1 from public.songs s
    where s.id = song_id and s.org_id = (select public.auth_org_id())
  )
)
with check (
  user_id = (select auth.uid()) and exists (
    select 1 from public.songs s
    where s.id = song_id and s.org_id = (select public.auth_org_id())
  )
);

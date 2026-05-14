/*
  Allow shared song chart updates.

  Song charts are maintained by the worship team the same way lyrics are, so
  non-creator updates should be allowed for lyrics and chordpro_text only.
*/

drop policy if exists "Authenticated users can update song lyrics" on public.songs;
drop policy if exists "Authenticated users can update song lyrics and charts" on public.songs;

create policy "Authenticated users can update song lyrics and charts"
  on public.songs
  for update
  to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

create or replace function public.guard_song_updates()
returns trigger
language plpgsql
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if old.created_by = (select auth.uid()) then
    return new;
  end if;

  if
    new.title is distinct from old.title or
    new.artist is distinct from old.artist or
    new.song_key is distinct from old.song_key or
    new.duration is distinct from old.duration or
    new.youtube_url is distinct from old.youtube_url or
    new.created_by is distinct from old.created_by or
    new.created_at is distinct from old.created_at or
    new.org_id is distinct from old.org_id
  then
    raise exception 'Only lyrics and chord charts can be updated for songs created by other users';
  end if;

  return new;
end;
$$;

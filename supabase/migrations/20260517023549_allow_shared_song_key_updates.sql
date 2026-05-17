/*
  Allow shared song key updates.

  Same-org users should be able to correct a song's base key while editing
  chord charts, alongside the already-allowed lyrics and chordpro_text fields.
*/

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
    new.duration is distinct from old.duration or
    new.youtube_url is distinct from old.youtube_url or
    new.created_by is distinct from old.created_by or
    new.created_at is distinct from old.created_at or
    new.org_id is distinct from old.org_id
  then
    raise exception 'Only lyrics, chord charts, and song keys can be updated for songs created by other users';
  end if;

  return new;
end;
$$;

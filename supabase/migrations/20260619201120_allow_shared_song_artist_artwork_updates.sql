/*
  Allow shared song artwork metadata updates.

  Team members should be able to improve artist and video-link metadata because
  those fields drive artwork matching across songs, setlists, and event cards.
  Song titles and ownership fields remain protected for the original creator.
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
    new.duration is distinct from old.duration or
    new.created_by is distinct from old.created_by or
    new.created_at is distinct from old.created_at or
    new.org_id is distinct from old.org_id
  then
    raise exception 'Only artist, video link, lyrics, chord charts, and song keys can be updated for songs created by other users';
  end if;

  return new;
end;
$$;

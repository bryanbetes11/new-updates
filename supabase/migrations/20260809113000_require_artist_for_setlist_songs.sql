create or replace function private.require_artist_before_setlist_song_use()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  missing_title text;
begin
  select songs.title
    into missing_title
  from public.songs
  where songs.id = new.song_id
    and nullif(btrim(coalesce(songs.artist, '')), '') is null;

  if found then
    raise exception using
      errcode = '23514',
      message = format('Add an artist before using "%s" in a set.', coalesce(missing_title, 'this song'));
  end if;

  return new;
end;
$$;

revoke all on function private.require_artist_before_setlist_song_use() from public;

drop trigger if exists require_artist_before_setlist_song_use on public.setlist_songs;
create trigger require_artist_before_setlist_song_use
before insert or update of song_id on public.setlist_songs
for each row
execute function private.require_artist_before_setlist_song_use();

create or replace function private.require_artists_before_setlist_review()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  missing_title text;
begin
  if new.status in ('pending_review', 'approved')
     and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    select songs.title
      into missing_title
    from public.setlist_songs
    join public.songs on songs.id = setlist_songs.song_id
    where setlist_songs.setlist_id = new.id
      and nullif(btrim(coalesce(songs.artist, '')), '') is null
    order by setlist_songs.position
    limit 1;

    if found then
      raise exception using
        errcode = '23514',
        message = format('Add an artist to "%s" before submitting or approving this set.', coalesce(missing_title, 'this song'));
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.require_artists_before_setlist_review() from public;

drop trigger if exists require_artists_before_setlist_review on public.setlists;
create trigger require_artists_before_setlist_review
before insert or update of status on public.setlists
for each row
execute function private.require_artists_before_setlist_review();

create or replace function private.prevent_clearing_artist_for_used_song()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if nullif(btrim(coalesce(new.artist, '')), '') is null
     and nullif(btrim(coalesce(old.artist, '')), '') is not null
     and exists (
       select 1
       from public.setlist_songs
       where setlist_songs.song_id = new.id
     ) then
    raise exception using
      errcode = '23514',
      message = 'Artist cannot be blank because this song is already used in a set.';
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_clearing_artist_for_used_song() from public;

drop trigger if exists prevent_clearing_artist_for_used_song on public.songs;
create trigger prevent_clearing_artist_for_used_song
before update of artist on public.songs
for each row
execute function private.prevent_clearing_artist_for_used_song();

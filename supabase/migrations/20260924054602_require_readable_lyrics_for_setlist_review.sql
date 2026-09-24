-- Validate new submissions and approvals without rewriting existing songs or
-- changing historical setlist statuses. A readable ChordPro chart can supply
-- lyrics when the separate songs.lyrics field is empty. Links, images, PDF
-- references, section labels, and chord-only rows cannot supply lyric text.
create or replace function private.song_text_has_readable_lyrics(p_text text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  raw_line text;
  lyric_line text;
  chord_line text;
begin
  foreach raw_line in array string_to_array(replace(coalesce(p_text, ''), chr(13), ''), chr(10)) loop
    if raw_line ~ '^[[:space:]]*\{[^}]*\}[[:space:]]*$'
      or raw_line ~* '^[[:space:]]*(!\[|<img([[:space:]>]))' then
      continue;
    end if;

    -- Remove inline [G] and [C] chord tokens before looking for sung words.
    lyric_line := btrim(regexp_replace(raw_line, '\[[^]]+\]', '', 'g'));
    -- Slash bass notes and repeat bars are still chords: Cmaj7/G | D/F#.
    chord_line := btrim(regexp_replace(replace(lyric_line, chr(92), ' '), '[-–—|:/]+', ' ', 'g'));
    if lyric_line !~ '[[:alpha:]]'
      or lyric_line ~* '^(intro|instrumental|interlude|verse([[:space:]]+[0-9]+)?|v[0-9]+|pre[-[:space:]]?chorus|chorus([[:space:]]+[0-9]+)?|refrain|bridge([[:space:]]+[0-9]+)?|b[0-9]+|tag|ending|outro|part([[:space:]]+[0-9]+)?|section([[:space:]]+[0-9]+)?|vamp|turnaround|breakdown|hook)[[:space:]]*[:-]?$'
      or lyric_line ~* '^(https?://|data:|file:|%PDF|[^[:space:]]+\.(pdf|png|jpe?g|webp)(\?[^[:space:]]*)?$)'
      or lyric_line ~* '^(lyrics?|words?)[[:space:]]+(not available|unavailable|missing|pending|coming soon|to be added|needed)\.?$'
      or chord_line ~* '^([[:space:]]*(N\.?C\.?|[A-G](#|b)?(m|maj|min|sus|dim|aug|add)?[0-9#b+()]*)[[:space:]]*)+$' then
      continue;
    end if;

    return true;
  end loop;

  return false;
end;
$$;

revoke all on function private.song_text_has_readable_lyrics(text)
  from public, anon, authenticated;

create or replace function private.require_readable_lyrics_for_setlist_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  song_count integer;
  missing_titles text;
begin
  if new.status not in ('pending_review', 'approved') then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;
  -- Spreadsheet imports create archival approved-use records before their
  -- historical songs are inserted. They are not proposal submissions.
  if tg_op = 'INSERT' and new.status = 'approved' and exists (
    select 1 from public.events event
    where event.id = new.event_id
      and event.org_id = new.org_id
      and event.event_type = 'imported'
  ) then
    return new;
  end if;

  select count(*) into song_count
  from public.setlist_songs item
  where item.setlist_id = new.id;
  if song_count = 0 then
    raise exception 'Add songs before submitting or approving this setlist.'
      using errcode = '23514';
  end if;

  select string_agg(coalesce(nullif(btrim(song.title), ''), 'Untitled song'), ', ' order by item.position)
  into missing_titles
  from public.setlist_songs item
  left join public.songs song
    on song.id = item.song_id and song.org_id = new.org_id
  where item.setlist_id = new.id
    and (
      item.org_id is distinct from new.org_id
      or song.id is null
      or not (
        private.song_text_has_readable_lyrics(song.lyrics)
        or private.song_text_has_readable_lyrics(song.chordpro_text)
      )
    );

  if missing_titles is not null then
    raise exception 'Add readable lyrics before submitting or approving this setlist. Missing: %', missing_titles
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.require_readable_lyrics_for_setlist_review()
  from public, anon, authenticated;
create trigger trg_require_readable_lyrics_for_setlist_review
  before insert or update of status on public.setlists
  for each row execute function private.require_readable_lyrics_for_setlist_review();

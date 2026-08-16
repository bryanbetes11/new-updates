create or replace function public.chat_message_preview(p_content text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  parsed jsonb;
  text_value text;
  reference_kind text;
begin
  begin
    parsed := p_content::jsonb;
  exception
    when others then
      return left(coalesce(nullif(trim(p_content), ''), 'Sent a message'), 100);
  end;

  if parsed->>'type' = 'image' then
    return 'Sent a photo';
  end if;

  if parsed->>'type' = 'file' then
    return 'Sent a file: ' || coalesce(nullif(parsed->>'name', ''), 'Attachment');
  end if;

  if parsed->>'type' = 'delete_request' then
    return 'Requested to delete this chat';
  end if;

  if parsed->>'type' = 'event_reference' then
    reference_kind := parsed->>'reference';

    if reference_kind = 'song' then
      text_value := nullif(trim(parsed->>'messageText'), '');
      if text_value is not null then
        return left(text_value, 100);
      end if;
      return left('Shared a song: ' || coalesce(nullif(parsed#>>'{song,title}', ''), 'Setlist song'), 100);
    end if;

    if reference_kind = 'setlist' then
      return left('Shared the setlist for ' || coalesce(nullif(parsed->>'eventTitle', ''), 'an event'), 100);
    end if;

    if reference_kind = 'observation' then
      return left('Shared a post-event observation for ' || coalesce(nullif(parsed->>'eventTitle', ''), 'an event'), 100);
    end if;

    return left('Shared an event: ' || coalesce(nullif(parsed->>'eventTitle', ''), 'Event'), 100);
  end if;

  text_value := nullif(trim(p_content), '');
  return left(coalesce(text_value, 'Sent a message'), 100);
end;
$$;

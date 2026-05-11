-- Add @mention support to chats with targeted mention notifications.
-- Mentioned users receive a normal app notification + push, while the
-- generic chat push skips those recipients to avoid duplicate banners.

create or replace function public.extract_conversation_mentions(
  p_text text,
  p_conversation_id uuid,
  p_sender_id uuid default null
)
returns table(user_id uuid)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with mention_tokens as (
    select distinct lower(regexp_replace(m[1], '[,.;:!?]+$', '')) as mention_key
    from regexp_matches(coalesce(p_text, ''), '@([^[:space:]]+)', 'g') as m
  )
  select distinct cm.user_id
  from mention_tokens mt
  join public.conversation_members cm
    on cm.conversation_id = p_conversation_id
  join public.profiles p
    on p.id = cm.user_id
  where cm.user_id <> coalesce(p_sender_id, cm.user_id)
    and lower(
      regexp_replace(
        trim(concat_ws('_', coalesce(p.first_name, ''), coalesce(p.last_name, ''))),
        '\s+',
        '_',
        'g'
      )
    ) = mt.mention_key;
$$;

create or replace function public.on_chat_message_mention()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sender_name text;
  v_conversation public.conversations%rowtype;
  v_mentioned_user_id uuid;
  v_conversation_label text;
begin
  if new.content is null or position('@' in new.content) = 0 then
    return new;
  end if;

  select *
  into v_conversation
  from public.conversations
  where id = new.conversation_id;

  if v_conversation.id is null then
    return new;
  end if;

  select coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Someone')
  into v_sender_name
  from public.profiles p
  where p.id = new.sender_id;

  if v_conversation.type = 'event' then
    select coalesce(e.title, 'Event Discussion')
    into v_conversation_label
    from public.events e
    where e.id = v_conversation.event_id;
  elsif v_conversation.type = 'group' then
    v_conversation_label := coalesce(nullif(v_conversation.name, ''), 'Group Chat');
  else
    v_conversation_label := 'a chat';
  end if;

  for v_mentioned_user_id in
    select user_id
    from public.extract_conversation_mentions(new.content, new.conversation_id, new.sender_id)
  loop
    perform public.create_notification(
      v_mentioned_user_id,
      'mention',
      'You were mentioned',
      case
        when v_conversation.type = 'personal' then
          coalesce(v_sender_name, 'Someone') || ' mentioned you in a chat.'
        else
          coalesce(v_sender_name, 'Someone') || ' mentioned you in ' || coalesce(v_conversation_label, 'a chat') || '.'
      end,
      jsonb_build_object(
        'url', '/messages/' || new.conversation_id,
        'conversation_id', new.conversation_id::text,
        'message_id', new.id::text,
        'sender_id', new.sender_id::text
      )
    );
  end loop;

  return new;
end;
$$;

create or replace function public.push_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sender_name text;
  v_conversation public.conversations%rowtype;
  v_member record;
  v_notification_title text;
  v_notification_body text;
  v_notification_url text;
  v_request_id bigint;
  v_mentioned_user_ids uuid[] := '{}'::uuid[];
begin
  select coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Someone')
  into v_sender_name
  from public.profiles p
  where p.id = new.sender_id;

  select *
  into v_conversation
  from public.conversations
  where id = new.conversation_id;

  if v_conversation.id is null then
    return new;
  end if;

  select coalesce(array_agg(em.user_id), '{}'::uuid[])
  into v_mentioned_user_ids
  from public.extract_conversation_mentions(new.content, new.conversation_id, new.sender_id) em;

  v_notification_url := '/messages/' || new.conversation_id;

  if v_conversation.type = 'event' then
    select coalesce(title, 'Event Discussion')
    into v_notification_title
    from public.events
    where id = v_conversation.event_id;
  elsif v_conversation.type = 'personal' then
    v_notification_title := coalesce(v_sender_name, 'New message');
  else
    v_notification_title := coalesce(nullif(v_conversation.name, ''), 'Group Chat');
  end if;

  v_notification_body := coalesce(v_sender_name, 'Someone') || ': ' || public.chat_message_preview(new.content);

  for v_member in
    select cm.user_id
    from public.conversation_members cm
    where cm.conversation_id = new.conversation_id
      and cm.user_id <> new.sender_id
      and not (cm.user_id = any(v_mentioned_user_ids))
  loop
    select net.http_post(
      url := 'https://uhwkrxihyqkagirdjhht.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'user_id', v_member.user_id::text,
        'title', v_notification_title,
        'body', v_notification_body,
        'data', jsonb_build_object(
          'url', v_notification_url,
          'conversation_id', new.conversation_id,
          'message_id', new.id,
          'sender_id', new.sender_id,
          'notification_id', new.id,
          'notification_type', 'message'
        )
      ),
      timeout_milliseconds := 15000
    ) into v_request_id;
  end loop;

  return new;
exception
  when others then
    raise warning 'Chat push notification request failed: %', sqlerrm;
    return new;
end;
$$;

drop trigger if exists trg_message_mention on public.messages;
create trigger trg_message_mention
  after insert on public.messages
  for each row
  execute function public.on_chat_message_mention();

grant execute on function public.extract_conversation_mentions(text, uuid, uuid) to authenticated;
grant execute on function public.on_chat_message_mention() to authenticated;
grant execute on function public.push_chat_message() to authenticated;

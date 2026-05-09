-- Use full profile names, not nicknames, in chat-generated identities.

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

grant execute on function public.push_chat_message() to authenticated;

create or replace function public.request_conversation_delete(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  conv_record public.conversations%rowtype;
  requester_name text;
begin
  if caller_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into conv_record
  from public.conversations
  where id = p_conversation_id;

  if conv_record.id is null then
    raise exception 'Conversation not found';
  end if;

  if conv_record.type <> 'personal' then
    raise exception 'Only personal chats require deletion confirmation';
  end if;

  if not exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = caller_id
  ) then
    raise exception 'Not a conversation member';
  end if;

  select coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Someone')
  into requester_name
  from public.profiles p
  where p.id = caller_id;

  insert into public.messages (conversation_id, sender_id, content, org_id)
  values (
    p_conversation_id,
    caller_id,
    jsonb_build_object(
      'type', 'delete_request',
      'requestedBy', caller_id,
      'requesterName', coalesce(requester_name, 'Someone'),
      'requestedAt', now()
    )::text,
    conv_record.org_id
  );

  update public.conversations
  set updated_at = now()
  where id = p_conversation_id;
end;
$$;

grant execute on function public.request_conversation_delete(uuid) to authenticated;

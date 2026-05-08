-- Conversation deletion and event discussion helpers.

create index if not exists conversations_event_discussion_lookup_idx
  on public.conversations (event_id)
  where type = 'event' and event_id is not null;

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

  select coalesce(nullif(p.nickname, ''), nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Someone')
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

create or replace function public.confirm_conversation_delete(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  conv_type text;
  requester_id uuid;
begin
  if caller_id is null then
    raise exception 'Not authenticated';
  end if;

  select c.type
  into conv_type
  from public.conversations c
  where c.id = p_conversation_id;

  if conv_type is distinct from 'personal' then
    raise exception 'Only personal chats use confirmation deletion';
  end if;

  if not exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = caller_id
  ) then
    raise exception 'Not a conversation member';
  end if;

  select m.sender_id
  into requester_id
  from public.messages m
  where m.conversation_id = p_conversation_id
    and m.sender_id <> caller_id
    and m.content like '%"type": "delete_request"%'
  order by m.created_at desc
  limit 1;

  if requester_id is null then
    raise exception 'No pending delete request from the other member';
  end if;

  delete from public.conversations
  where id = p_conversation_id;
end;
$$;

create or replace function public.delete_conversation_as_creator(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  conv_record public.conversations%rowtype;
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

  if conv_record.type = 'personal' then
    raise exception 'Personal chats require confirmation from the other member';
  end if;

  if conv_record.created_by <> caller_id then
    raise exception 'Only the creator can delete this chat';
  end if;

  delete from public.conversations
  where id = p_conversation_id;
end;
$$;

create or replace function public.create_event_conversation(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  event_record public.events%rowtype;
  conv_id uuid;
  member_id uuid;
  target_org_id uuid;
begin
  if caller_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into event_record
  from public.events
  where id = p_event_id;

  if event_record.id is null then
    raise exception 'Event not found';
  end if;

  if event_record.org_id is not null and event_record.org_id <> public.auth_org_id() then
    raise exception 'Event is outside your organization';
  end if;

  target_org_id := coalesce(event_record.org_id, public.auth_org_id());

  select c.id
  into conv_id
  from public.conversations c
  where c.type = 'event'
    and c.event_id = p_event_id
  limit 1;

  if conv_id is null then
    insert into public.conversations (type, name, event_id, created_by, org_id)
    values ('event', event_record.title, event_record.id, caller_id, target_org_id)
    returning id into conv_id;
  else
    update public.conversations
    set name = event_record.title,
        org_id = coalesce(org_id, target_org_id),
        updated_at = now()
    where id = conv_id;
  end if;

  for member_id in
    select distinct user_id
    from (
      select caller_id as user_id
      union all
      select event_record.created_by
      union all
      select ea.user_id
      from public.event_assignments ea
      where ea.event_id = p_event_id
    ) members
    where user_id is not null
  loop
    insert into public.conversation_members (conversation_id, user_id, org_id)
    values (conv_id, member_id, target_org_id)
    on conflict (conversation_id, user_id) do update
      set org_id = coalesce(public.conversation_members.org_id, excluded.org_id);
  end loop;

  return conv_id;
end;
$$;

grant execute on function public.request_conversation_delete(uuid) to authenticated;
grant execute on function public.confirm_conversation_delete(uuid) to authenticated;
grant execute on function public.delete_conversation_as_creator(uuid) to authenticated;
grant execute on function public.create_event_conversation(uuid) to authenticated;

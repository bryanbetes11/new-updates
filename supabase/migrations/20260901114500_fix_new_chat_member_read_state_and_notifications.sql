alter table public.conversation_members
  alter column last_read_at drop default;

insert into public.notification_rules (
  org_id,
  type,
  label,
  category,
  description,
  target_roles,
  enabled,
  required,
  in_app_enabled,
  push_enabled,
  priority
)
select
  organization.id,
  'conversation_added',
  'Added to chat',
  'communication',
  'A member is notified when they are added to a group or event chat.',
  array['Conversation members'],
  true,
  false,
  true,
  true,
  'normal'
from public.organizations organization
on conflict (org_id, type) do update
set label = excluded.label,
    category = excluded.category,
    description = excluded.description,
    target_roles = excluded.target_roles,
    in_app_enabled = true,
    push_enabled = true,
    updated_at = now();

-- Deliver the invitation that was missed for recent additions made while the
-- read-marker default was still active. The membership id keeps this idempotent.
do $$
declare
  membership record;
begin
  for membership in
    select
      cm.id,
      cm.user_id,
      cm.conversation_id,
      c.type as conversation_type,
      c.event_id,
      coalesce(nullif(btrim(c.name), ''), 'a ServeSync chat') as conversation_name
    from public.conversation_members cm
    join public.conversations c on c.id = cm.conversation_id
    where cm.joined_at >= now() - interval '1 day'
      and cm.last_read_at = cm.joined_at
      and exists (
        select 1
        from public.messages message
        where message.conversation_id = cm.conversation_id
          and message.created_at < cm.joined_at
          and message.deleted_at is null
      )
  loop
    perform public.create_notification(
      membership.user_id,
      'conversation_added',
      'Added to a chat',
      'You were added to ' || membership.conversation_name || '.',
      jsonb_strip_nulls(jsonb_build_object(
        'type', 'conversation_added',
        'conversation_id', membership.conversation_id::text,
        'conversation_type', membership.conversation_type,
        'event_id', membership.event_id::text,
        'url', '/messages/' || membership.conversation_id::text,
        'dedupe_key', 'conversation-added:' || membership.id::text
      ))
    );
  end loop;
end;
$$;

-- A timestamp exactly equal to joined_at came from the old column default,
-- not from opening the chat. Clear only markers that falsely cover messages
-- which already existed before that member joined.
update public.conversation_members cm
set last_read_at = null
where cm.last_read_at = cm.joined_at
  and exists (
    select 1
    from public.messages message
    where message.conversation_id = cm.conversation_id
      and message.created_at < cm.joined_at
      and message.deleted_at is null
  );

create or replace function public.add_group_conversation_members(
  p_conversation_id uuid,
  p_member_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id uuid := auth.uid();
  target_conversation public.conversations%rowtype;
  caller_name text;
  target_org_id uuid;
  member_id uuid;
  inserted_membership_id uuid;
  conversation_label text;
begin
  if caller_id is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(array_length(p_member_ids, 1), 0) = 0 then
    return;
  end if;

  select c.*
  into target_conversation
  from public.conversations c
  join public.conversation_members cm on cm.conversation_id = c.id
  where c.id = p_conversation_id
    and c.type in ('group', 'event')
    and cm.user_id = caller_id
  limit 1;

  if target_conversation.id is null then
    raise exception 'Only group or event chat members can add members to this chat';
  end if;

  target_org_id := coalesce(target_conversation.org_id, public.auth_org_id());
  conversation_label := coalesce(nullif(btrim(target_conversation.name), ''), 'a ServeSync chat');

  select nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), '')
  into caller_name
  from public.profiles p
  where p.id = caller_id;

  foreach member_id in array p_member_ids
  loop
    if member_id is null or member_id = caller_id then
      continue;
    end if;

    if not exists (
      select 1
      from public.profiles p
      where p.id = member_id
        and p.org_id = target_org_id
    ) then
      raise exception 'Selected user is outside this organization';
    end if;

    inserted_membership_id := null;
    insert into public.conversation_members (
      conversation_id,
      user_id,
      org_id,
      last_read_at
    )
    values (p_conversation_id, member_id, target_org_id, null)
    on conflict (conversation_id, user_id) do nothing
    returning id into inserted_membership_id;

    if inserted_membership_id is not null then
      perform public.create_notification(
        member_id,
        'conversation_added',
        'Added to a chat',
        coalesce(caller_name, 'A team member') || ' added you to ' || conversation_label || '.',
        jsonb_strip_nulls(jsonb_build_object(
          'type', 'conversation_added',
          'conversation_id', p_conversation_id::text,
          'conversation_type', target_conversation.type,
          'event_id', target_conversation.event_id::text,
          'added_by', caller_id::text,
          'url', '/messages/' || p_conversation_id::text,
          'dedupe_key', 'conversation-added:' || inserted_membership_id::text
        ))
      );
    end if;
  end loop;

  update public.conversations
  set updated_at = now()
  where id = p_conversation_id;
end;
$$;

revoke all on function public.add_group_conversation_members(uuid, uuid[]) from public, anon;
grant execute on function public.add_group_conversation_members(uuid, uuid[]) to authenticated;

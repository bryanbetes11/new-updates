-- Keep an administrator's command-testing conversation separate from the
-- event's regular team conversation while linking both to the same event and
-- setlist data.

create or replace function public.create_admin_test_event_conversation(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  event_record public.events%rowtype;
  conv_id uuid;
  target_org_id uuid;
  caller_can_test boolean := false;
begin
  if caller_id is null then
    raise exception 'Not authenticated';
  end if;

  select
    coalesce(public.auth_is_org_admin(), false)
    or coalesce(public.is_platform_owner(), false)
    or exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = caller_id
        and ur.org_id = public.auth_org_id()
        and r.name in ('Admin', 'Admin Coordinator')
    )
  into caller_can_test;

  if not caller_can_test then
    raise exception 'Only administrators can create an admin test event chat';
  end if;

  select *
  into event_record
  from public.events
  where id = p_event_id;

  if event_record.id is null then
    raise exception 'Event not found';
  end if;

  if event_record.org_id is not null
    and event_record.org_id <> public.auth_org_id()
    and not public.is_platform_owner() then
    raise exception 'Event is outside your organization';
  end if;

  target_org_id := coalesce(event_record.org_id, public.auth_org_id());

  select c.id
  into conv_id
  from public.conversations c
  where c.type = 'event'
    and c.event_id = p_event_id
    and c.created_by = caller_id
    and c.name like '[Admin Test] %'
  limit 1;

  if conv_id is null then
    insert into public.conversations (type, name, event_id, created_by, org_id)
    values ('event', '[Admin Test] ' || event_record.title, event_record.id, caller_id, target_org_id)
    returning id into conv_id;
  else
    update public.conversations
    set name = '[Admin Test] ' || event_record.title,
        org_id = coalesce(org_id, target_org_id),
        updated_at = now()
    where id = conv_id;
  end if;

  insert into public.conversation_members (conversation_id, user_id, org_id)
  values (conv_id, caller_id, target_org_id)
  on conflict (conversation_id, user_id) do update
    set org_id = coalesce(public.conversation_members.org_id, excluded.org_id);

  return conv_id;
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
    and c.name not like '[Admin Test] %'
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

revoke all on function public.create_admin_test_event_conversation(uuid) from public;
revoke all on function public.create_admin_test_event_conversation(uuid) from anon;
grant execute on function public.create_admin_test_event_conversation(uuid) to authenticated;

revoke all on function public.create_event_conversation(uuid) from public;
revoke all on function public.create_event_conversation(uuid) from anon;
grant execute on function public.create_event_conversation(uuid) to authenticated;

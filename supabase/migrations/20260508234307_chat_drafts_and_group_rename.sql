create or replace function public.rename_group_conversation(
  p_conversation_id uuid,
  p_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  next_name text := nullif(trim(p_name), '');
begin
  if caller_id is null then
    raise exception 'Not authenticated';
  end if;

  if next_name is null then
    raise exception 'Group name is required';
  end if;

  if length(next_name) > 80 then
    raise exception 'Group name must be 80 characters or less';
  end if;

  if not exists (
    select 1
    from public.conversations c
    join public.conversation_members cm on cm.conversation_id = c.id
    where c.id = p_conversation_id
      and c.type = 'group'
      and cm.user_id = caller_id
  ) then
    raise exception 'Only group members can rename this chat';
  end if;

  update public.conversations
  set name = next_name,
      updated_at = now()
  where id = p_conversation_id
    and type = 'group';
end;
$$;

create or replace function public.discard_empty_conversation(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = caller_id
  ) then
    raise exception 'Not a conversation member';
  end if;

  if exists (
    select 1
    from public.messages m
    where m.conversation_id = p_conversation_id
      and m.deleted_at is null
  ) then
    return;
  end if;

  delete from public.conversations
  where id = p_conversation_id;
end;
$$;

grant execute on function public.rename_group_conversation(uuid, text) to authenticated;
grant execute on function public.discard_empty_conversation(uuid) to authenticated;

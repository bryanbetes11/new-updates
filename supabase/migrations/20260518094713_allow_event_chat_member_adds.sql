create or replace function public.add_group_conversation_members(
  p_conversation_id uuid,
  p_member_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  target_org_id uuid;
  member_id uuid;
begin
  if caller_id is null then
    raise exception 'Not authenticated';
  end if;

  if array_length(p_member_ids, 1) is null or array_length(p_member_ids, 1) = 0 then
    return;
  end if;

  select coalesce(c.org_id, public.auth_org_id())
  into target_org_id
  from public.conversations c
  join public.conversation_members cm on cm.conversation_id = c.id
  where c.id = p_conversation_id
    and c.type in ('group', 'event')
    and cm.user_id = caller_id
  limit 1;

  if target_org_id is null then
    raise exception 'Only group or event chat members can add members to this chat';
  end if;

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

    insert into public.conversation_members (conversation_id, user_id, org_id)
    values (p_conversation_id, member_id, target_org_id)
    on conflict (conversation_id, user_id) do update
      set org_id = coalesce(public.conversation_members.org_id, excluded.org_id);
  end loop;

  update public.conversations
  set updated_at = now()
  where id = p_conversation_id;
end;
$$;

grant execute on function public.add_group_conversation_members(uuid, uuid[]) to authenticated;

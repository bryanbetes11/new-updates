create or replace function public.enforce_conversation_member_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_org_id uuid;
  v_member_org_id uuid;
begin
  if tg_op = 'UPDATE' then
    if new.conversation_id is distinct from old.conversation_id
      or new.user_id is distinct from old.user_id
      or new.org_id is distinct from old.org_id
    then
      raise exception 'Conversation membership identity cannot be changed';
    end if;

    new.org_id := old.org_id;
    return new;
  end if;

  select org_id into v_conversation_org_id
  from public.conversations
  where id = new.conversation_id;

  select org_id into v_member_org_id
  from public.profiles
  where id = new.user_id;

  if v_conversation_org_id is null
    or v_member_org_id is null
    or v_member_org_id <> v_conversation_org_id
  then
    raise exception 'Conversation member must belong to the same church';
  end if;

  new.org_id := v_conversation_org_id;
  return new;
end;
$$;

revoke all on function public.enforce_conversation_member_tenant() from public, anon, authenticated;


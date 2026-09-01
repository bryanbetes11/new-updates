create or replace function public.set_active_conversation(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id uuid := auth.uid();
  v_org_id uuid;
  v_seen_at timestamptz := clock_timestamp();
begin
  if caller_id is null then
    raise exception 'Not authenticated';
  end if;

  select c.org_id
  into v_org_id
  from public.conversations c
  join public.conversation_members cm on cm.conversation_id = c.id
  where c.id = p_conversation_id
    and cm.user_id = caller_id;

  if not found then
    raise exception 'Not a conversation member';
  end if;

  -- Opening a chat is the authoritative read action. Keeping this update in
  -- the membership-checked RPC avoids a separate client RLS write silently
  -- affecting zero rows and keeps unread badges and seen receipts in sync.
  update public.conversation_members cm
  set last_read_at = greatest(coalesce(cm.last_read_at, '-infinity'::timestamptz), v_seen_at)
  where cm.conversation_id = p_conversation_id
    and cm.user_id = caller_id;

  insert into public.active_conversation_views (user_id, conversation_id, last_seen_at, org_id)
  values (caller_id, p_conversation_id, v_seen_at, v_org_id)
  on conflict (user_id) do update
    set conversation_id = excluded.conversation_id,
        last_seen_at = excluded.last_seen_at,
        org_id = excluded.org_id;
end;
$$;

revoke all on function public.set_active_conversation(uuid) from public, anon;
grant execute on function public.set_active_conversation(uuid) to authenticated;


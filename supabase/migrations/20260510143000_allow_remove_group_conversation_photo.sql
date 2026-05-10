create or replace function public.set_group_conversation_photo(
  p_conversation_id uuid,
  p_photo_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  next_photo_url text := nullif(trim(p_photo_url), '');
begin
  if caller_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.conversations c
    join public.conversation_members cm on cm.conversation_id = c.id
    where c.id = p_conversation_id
      and c.type = 'group'
      and cm.user_id = caller_id
  ) then
    raise exception 'Only group members can update this photo';
  end if;

  update public.conversations
  set photo_url = next_photo_url,
      updated_at = now()
  where id = p_conversation_id
    and type = 'group';
end;
$$;

grant execute on function public.set_group_conversation_photo(uuid, text) to authenticated;

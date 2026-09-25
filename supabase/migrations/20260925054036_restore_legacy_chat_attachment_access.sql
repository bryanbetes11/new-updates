-- Older chat uploads used uploader-id/filename rather than uploader-id/files/uuid-filename.
-- Preserve only objects referenced by a message from that uploader in a joined conversation.
create or replace function public.can_read_chat_attachment(p_name text, p_viewer uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_uploader uuid;
  v_file text;
  v_marker text;
begin
  if p_viewer is null or p_name !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/' then
    return false;
  end if;
  v_uploader := split_part(p_name, '/', 1)::uuid;

  if p_name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$' then
    return exists (
      select 1 from public.messages m
      join public.conversations c on c.id=m.conversation_id and c.org_id=m.org_id
      join public.conversation_members member on member.conversation_id=c.id
        and member.org_id=c.org_id and member.user_id=p_viewer
      where m.sender_id=v_uploader
        and position('/chat-attachments/' || p_name in m.content)>0
        and c.org_id is not null
    );
  end if;

  if p_name !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(files|group-photos)/' then
    return false;
  end if;
  v_file := split_part(p_name, '/', array_length(string_to_array(p_name, '/'), 1));
  v_marker := left(v_file, 36);
  if v_marker !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  if split_part(p_name, '/', 2) = 'files' then
    return exists (
      select 1 from public.messages m
      join public.conversations c on c.id=m.conversation_id and c.org_id=m.org_id
      join public.conversation_members member on member.conversation_id=c.id
        and member.org_id=c.org_id and member.user_id=p_viewer
      where m.sender_id=v_uploader and position(v_marker in m.content)>0
        and c.org_id is not null
    );
  end if;
  return exists (
    select 1 from public.conversations c
    join public.conversation_members member on member.conversation_id=c.id
      and member.org_id=c.org_id and member.user_id=p_viewer
    join public.profiles uploader on uploader.id=v_uploader and uploader.org_id=c.org_id
    where c.id=v_marker::uuid and position(v_marker in coalesce(c.photo_url,''))>0
  );
end;
$$;

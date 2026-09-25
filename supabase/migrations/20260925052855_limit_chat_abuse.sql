-- Limit authenticated chat floods at the database, including direct API calls.
create index if not exists messages_sender_created_limit_idx
  on public.messages(sender_id,created_at desc);

create or replace function public.limit_member_chat_writes()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() is distinct from 'authenticated' then return new; end if;
  if new.sender_id is distinct from auth.uid() then raise exception 'Message sender mismatch'; end if;
  if octet_length(coalesce(new.content,'')) > 16384 then raise exception 'Message is too long'; end if;
  -- Serialize one member's sends so parallel requests cannot evade the window.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(new.sender_id::text), 2566);
  if (select count(*) from public.messages
      where sender_id=new.sender_id and created_at > now()-interval '1 minute') >= 60 then
    raise exception 'Too many messages. Please wait a minute';
  end if;
  return new;
end;
$$;
revoke all on function public.limit_member_chat_writes() from public, anon, authenticated;
drop trigger if exists messages_limit_member_writes on public.messages;
create trigger messages_limit_member_writes before insert on public.messages
  for each row execute function public.limit_member_chat_writes();

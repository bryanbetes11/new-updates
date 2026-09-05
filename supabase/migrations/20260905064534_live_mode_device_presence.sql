-- Track each open device independently; closing a phone must not mark its PC offline.
alter table public.live_mode_participants add column session_id uuid not null default gen_random_uuid();
alter table public.live_mode_participants drop constraint live_mode_participants_pkey;
alter table public.live_mode_participants add primary key(event_id,user_id,session_id);
drop function public.live_mode_heartbeat(uuid,text,boolean);
create function public.live_mode_heartbeat(p_event uuid,p_audience text,p_session uuid,p_active boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_audience not in ('stage','tech') or p_session is null or not public.live_mode_access(p_event,p_audience) then
    raise exception 'Live Mode access unavailable' using errcode='42501'; end if;
  if not p_active then delete from public.live_mode_participants where event_id=p_event and user_id=auth.uid() and session_id=p_session; return; end if;
  insert into public.live_mode_participants(event_id,user_id,audience,session_id,last_seen) values(p_event,auth.uid(),p_audience,p_session,clock_timestamp())
    on conflict(event_id,user_id,session_id) do update set audience=excluded.audience,last_seen=excluded.last_seen;
end; $$;
revoke all on function public.live_mode_heartbeat(uuid,text,uuid,boolean) from public,anon;
grant execute on function public.live_mode_heartbeat(uuid,text,uuid,boolean) to authenticated;

-- Durable event communication. No push/email triggers: these are in-session cues.
create table public.live_mode_messages (
  id uuid primary key,
  event_id uuid not null references public.events(id) on delete cascade,
  org_id uuid not null references public.organizations(id),
  kind text not null check (kind in ('stage_request','tech_instruction','position')),
  sender_id uuid not null references public.profiles(id),
  sender_name text not null,
  sender_role text not null,
  recipient_id uuid references public.profiles(id),
  text text not null check (length(text) between 1 and 160),
  status text not null default 'sent' check (status in ('sent','seen','adjusting','done','cancelled')),
  operator_name text,
  revision integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index live_mode_messages_event_created on public.live_mode_messages(event_id, created_at);
create table public.live_mode_participants (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  audience text not null check (audience in ('stage','tech')),
  last_seen timestamptz not null default now(),
  primary key(event_id,user_id)
);

-- Authorization is derived from canonical profiles/assignments, never client role labels.
create function public.live_mode_access(p_event uuid, p_capability text default 'read') returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.events e join public.profiles p on p.id=auth.uid() and p.org_id=e.org_id
    where e.id=p_event and (
      p.is_org_admin or exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id
        where ur.user_id=p.id and ur.org_id=e.org_id and lower(r.name) in ('admin','platform owner'))
      or exists(select 1 from public.event_assignments a join public.roles r on r.id=a.role_id
        where a.event_id=e.id and a.org_id=e.org_id and a.user_id=p.id and a.status='confirmed'
          and lower(r.name)<>'all members' and (
            p_capability='read' or (p_capability='tech' and lower(r.name) in ('audio','lights','visuals'))
            or (p_capability='stage' and lower(r.name) not in ('audio','lights','visuals'))
            or (p_capability='lead' and lower(r.name)='song leader')
          ))
    )
  );
$$;
revoke all on function public.live_mode_access(uuid,text) from public,anon;
grant execute on function public.live_mode_access(uuid,text) to authenticated;
alter table public.live_mode_messages enable row level security;
alter table public.live_mode_participants enable row level security;
revoke all on public.live_mode_messages,public.live_mode_participants from anon,authenticated;
grant select on public.live_mode_messages,public.live_mode_participants to authenticated;
create policy live_messages_read on public.live_mode_messages for select to authenticated
using(public.live_mode_access(event_id,'read'));
create policy live_participants_read on public.live_mode_participants for select to authenticated
using(public.live_mode_access(event_id,'read'));

create function public.send_live_mode_message(p_event uuid,p_id uuid,p_kind text,p_text text,p_recipient uuid default null)
returns public.live_mode_messages language plpgsql security definer set search_path = '' as $$
declare result public.live_mode_messages; actor public.profiles; role_name text;
begin
  if not public.live_mode_access(p_event,case p_kind when 'tech_instruction' then 'tech' when 'position' then 'lead' else 'stage' end)
    then raise exception 'Your confirmed event role cannot send this cue' using errcode='42501'; end if;
  if p_kind not in ('stage_request','tech_instruction','position') or length(trim(p_text)) not between 1 and 160
    then raise exception 'Invalid cue'; end if;
  select * into actor from public.profiles where id=auth.uid();
  if p_kind='tech_instruction' and not exists(select 1 from public.event_assignments a join public.roles r on r.id=a.role_id
      where a.event_id=p_event and a.org_id=actor.org_id and a.user_id=p_recipient and a.status='confirmed'
      and lower(r.name) not in ('all members','audio','lights','visuals'))
    then raise exception 'Recipient must be a confirmed stage performer'; end if;
  if p_kind<>'tech_instruction' and p_recipient is not null then raise exception 'Unexpected recipient'; end if;
  select r.name into role_name from public.event_assignments a join public.roles r on r.id=a.role_id
    where a.event_id=p_event and a.user_id=auth.uid() and a.status='confirmed' order by (r.name='Song Leader') desc limit 1;
  insert into public.live_mode_messages(id,event_id,org_id,kind,sender_id,sender_name,sender_role,recipient_id,text)
    values(p_id,p_event,actor.org_id,p_kind,auth.uid(),coalesce(nullif(actor.nickname,''),actor.first_name),coalesce(role_name,'Admin'),p_recipient,trim(p_text))
    on conflict(id) do nothing returning * into result;
  if result.id is null then
    select * into result from public.live_mode_messages where id=p_id;
    if result.sender_id is distinct from auth.uid() or result.event_id is distinct from p_event
      or result.kind is distinct from p_kind or result.text is distinct from trim(p_text)
      or result.recipient_id is distinct from p_recipient then raise exception 'Cue ID already used'; end if;
  end if;
  return result;
end; $$;

create function public.update_live_mode_message(p_id uuid,p_status text,p_revision integer)
returns public.live_mode_messages language plpgsql security definer set search_path = '' as $$
declare result public.live_mode_messages; actor_name text;
begin
  select * into result from public.live_mode_messages where id=p_id for update;
  if result.id is null or not public.live_mode_access(result.event_id,'read') then raise exception 'Cue unavailable' using errcode='42501'; end if;
  if result.kind='stage_request' then
    if p_status='cancelled' then
      if result.sender_id<>auth.uid() then raise exception 'Only the sender can cancel' using errcode='42501'; end if;
    elsif p_status not in ('seen','adjusting','done','sent') or not public.live_mode_access(result.event_id,'tech') then
      raise exception 'Only the event tech team can update requests' using errcode='42501';
    end if;
  elsif result.kind='tech_instruction' then
    if result.recipient_id<>auth.uid() or p_status<>'seen' then raise exception 'Only the recipient can acknowledge' using errcode='42501'; end if;
  else raise exception 'This cue cannot be updated'; end if;
  if result.status=p_status then return result; end if;
  if result.revision<>p_revision then raise exception 'Request changed on another device. Refresh and try again.'; end if;
  select coalesce(nullif(nickname,''),first_name) into actor_name from public.profiles where id=auth.uid();
  update public.live_mode_messages set status=p_status,operator_name=actor_name,revision=revision+1,updated_at=clock_timestamp()
    where id=p_id returning * into result;
  return result;
end; $$;

create function public.live_mode_heartbeat(p_event uuid,p_audience text,p_active boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_audience not in ('stage','tech') or not public.live_mode_access(p_event,p_audience) then
    raise exception 'Live Mode access unavailable' using errcode='42501'; end if;
  if not p_active then delete from public.live_mode_participants where event_id=p_event and user_id=auth.uid(); return; end if;
  insert into public.live_mode_participants(event_id,user_id,audience,last_seen) values(p_event,auth.uid(),p_audience,clock_timestamp())
    on conflict(event_id,user_id) do update set audience=excluded.audience,last_seen=excluded.last_seen;
end; $$;
revoke all on function public.send_live_mode_message(uuid,uuid,text,text,uuid),public.update_live_mode_message(uuid,text,integer),public.live_mode_heartbeat(uuid,text,boolean) from public,anon;
grant execute on function public.send_live_mode_message(uuid,uuid,text,text,uuid),public.update_live_mode_message(uuid,text,integer),public.live_mode_heartbeat(uuid,text,boolean) to authenticated;
alter publication supabase_realtime add table public.live_mode_messages;

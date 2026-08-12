alter table public.conversations
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null;

alter table public.conversation_members
  add column if not exists archived_at timestamptz;

create or replace function public.archive_conversation_for_me(p_conversation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.conversation_members
  set archived_at = statement_timestamp()
  where conversation_id = p_conversation_id and user_id = (select auth.uid());
  if not found then raise exception 'Conversation membership not found'; end if;
end;
$$;

create or replace function public.archive_conversation_for_everyone(p_conversation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.conversation_members cm
    join public.conversations c on c.id = cm.conversation_id
    join public.profiles p on p.id = (select auth.uid())
    join public.profiles creator on creator.id = c.created_by
    join public.user_roles ur on ur.user_id = p.id
    join public.roles r on r.id = ur.role_id and r.is_leadership = true
    where cm.conversation_id = p_conversation_id and cm.user_id = p.id
      and (c.org_id = p.org_id or (c.org_id is null and creator.org_id = p.org_id))
  ) then raise exception 'Leadership access required'; end if;
  update public.conversations set archived_at = statement_timestamp(), archived_by = (select auth.uid()) where id = p_conversation_id;
end;
$$;

create or replace function public.leave_conversation(p_conversation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_conversation public.conversations%rowtype;
begin
  select * into v_conversation from public.conversations where id = p_conversation_id;
  if v_conversation.type <> 'group' then raise exception 'Only group chats can be left'; end if;
  if v_conversation.created_by = (select auth.uid()) then raise exception 'The group creator cannot leave'; end if;
  delete from public.conversation_members where conversation_id = p_conversation_id and user_id = (select auth.uid());
  if not found then raise exception 'Conversation membership not found'; end if;
end;
$$;

revoke all on function public.archive_conversation_for_me(uuid) from public, anon;
revoke all on function public.archive_conversation_for_everyone(uuid) from public, anon;
revoke all on function public.leave_conversation(uuid) from public, anon;
grant execute on function public.archive_conversation_for_me(uuid) to authenticated;
grant execute on function public.archive_conversation_for_everyone(uuid) to authenticated;
grant execute on function public.leave_conversation(uuid) to authenticated;

create or replace function public.get_conversations()
returns table (id uuid, type text, name text, photo_url text, event_id uuid, created_by uuid, created_at timestamptz, updated_at timestamptz, members jsonb, last_message jsonb, unread_count bigint)
language sql stable security definer set search_path = '' as $$
  with caller as materialized (
    select p.id user_id, p.org_id from public.profiles p where p.id = (select auth.uid()) and p.org_id is not null
  ), authorized_conversations as materialized (
    select c.id,c.type,c.name,c.photo_url,c.event_id,c.created_by,c.created_at,c.updated_at,caller.user_id viewer_id,caller.org_id viewer_org_id,mine.last_read_at
    from caller join public.conversation_members mine on mine.user_id=caller.user_id and (mine.org_id=caller.org_id or mine.org_id is null)
    join public.conversations c on c.id=mine.conversation_id left join public.profiles creator on creator.id=c.created_by
    where mine.archived_at is null and c.archived_at is null and (c.org_id=caller.org_id or (c.org_id is null and creator.org_id=caller.org_id))
  ), conversation_members as (
    select c.id conversation_id,jsonb_agg(jsonb_build_object('user_id',cm.user_id,'last_read_at',cm.last_read_at,'profile',case when p.id is null then null else jsonb_build_object('id',p.id,'first_name',p.first_name,'last_name',p.last_name,'nickname',p.nickname,'avatar_url',p.avatar_url) end) order by cm.joined_at,cm.user_id) members
    from authorized_conversations c join public.conversation_members cm on cm.conversation_id=c.id and (cm.org_id=c.viewer_org_id or cm.org_id is null) join public.profiles p on p.id=cm.user_id and p.org_id=c.viewer_org_id group by c.id
  ), last_messages as (
    select distinct on (m.conversation_id) m.conversation_id,m.id,m.content,m.sender_id,m.created_at from public.messages m join authorized_conversations c on c.id=m.conversation_id where m.deleted_at is null order by m.conversation_id,m.created_at desc,m.id desc
  ), unread_counts as (
    select m.conversation_id,count(*)::bigint unread_count from public.messages m join authorized_conversations c on c.id=m.conversation_id where m.deleted_at is null and m.sender_id<>c.viewer_id and (c.last_read_at is null or m.created_at>c.last_read_at) group by m.conversation_id
  )
  select c.id,c.type,c.name,c.photo_url,c.event_id,c.created_by,c.created_at,c.updated_at,coalesce(cm.members,'[]'::jsonb),case when lm.id is null then null else jsonb_build_object('id',lm.id,'content',lm.content,'sender_id',lm.sender_id,'created_at',lm.created_at) end,coalesce(uc.unread_count,0::bigint)
  from authorized_conversations c left join conversation_members cm on cm.conversation_id=c.id left join last_messages lm on lm.conversation_id=c.id left join unread_counts uc on uc.conversation_id=c.id
  order by greatest(coalesce(c.updated_at,'-infinity'::timestamptz),coalesce(lm.created_at,'-infinity'::timestamptz),coalesce(c.created_at,'-infinity'::timestamptz)) desc,c.id;
$$;

revoke all on function public.get_conversations() from public, anon;
grant execute on function public.get_conversations() to authenticated;

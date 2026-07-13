create index if not exists messages_visible_conversation_created_idx
  on public.messages (conversation_id, created_at desc, id desc)
  include (sender_id)
  where deleted_at is null;

with latest_messages as (
  select distinct on (m.conversation_id)
    m.conversation_id,
    m.created_at
  from public.messages m
  where m.deleted_at is null
  order by m.conversation_id, m.created_at desc, m.id desc
)
update public.conversations c
set updated_at = latest_messages.created_at
from latest_messages
where c.id = latest_messages.conversation_id
  and (
    c.updated_at is null
    or c.updated_at < latest_messages.created_at
  );

create or replace function public.touch_conversation_on_message_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
  set updated_at = statement_timestamp()
  where id = new.conversation_id;

  return new;
end;
$$;

revoke all on function public.touch_conversation_on_message_insert() from public;
revoke all on function public.touch_conversation_on_message_insert() from anon;
revoke all on function public.touch_conversation_on_message_insert() from authenticated;

drop trigger if exists on_new_message_update_conversation on public.messages;
create trigger on_new_message_update_conversation
  after insert on public.messages
  for each row
  execute function public.touch_conversation_on_message_insert();

create or replace function public.get_conversations()
returns table (
  id uuid,
  type text,
  name text,
  photo_url text,
  event_id uuid,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  members jsonb,
  last_message jsonb,
  unread_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with caller as materialized (
    select
      p.id as user_id,
      p.org_id
    from public.profiles p
    where p.id = (select auth.uid())
      and p.org_id is not null
  ),
  authorized_conversations as materialized (
    select
      c.id,
      c.type,
      c.name,
      c.photo_url,
      c.event_id,
      c.created_by,
      c.created_at,
      c.updated_at,
      caller.user_id as viewer_id,
      caller.org_id as viewer_org_id,
      mine.last_read_at
    from caller
    join public.conversation_members mine
      on mine.user_id = caller.user_id
     and (mine.org_id = caller.org_id or mine.org_id is null)
    join public.conversations c
      on c.id = mine.conversation_id
    left join public.profiles creator
      on creator.id = c.created_by
    where c.org_id = caller.org_id
       or (c.org_id is null and creator.org_id = caller.org_id)
  ),
  conversation_members as (
    select
      c.id as conversation_id,
      jsonb_agg(
        jsonb_build_object(
          'user_id', cm.user_id,
          'last_read_at', cm.last_read_at,
          'profile', case
            when p.id is null then null
            else jsonb_build_object(
              'id', p.id,
              'first_name', p.first_name,
              'last_name', p.last_name,
              'nickname', p.nickname,
              'avatar_url', p.avatar_url
            )
          end
        )
        order by cm.joined_at, cm.user_id
      ) as members
    from authorized_conversations c
    join public.conversation_members cm
      on cm.conversation_id = c.id
     and (cm.org_id = c.viewer_org_id or cm.org_id is null)
    join public.profiles p
      on p.id = cm.user_id
     and p.org_id = c.viewer_org_id
    group by c.id
  ),
  last_messages as (
    select distinct on (m.conversation_id)
      m.conversation_id,
      m.id,
      m.content,
      m.sender_id,
      m.created_at
    from public.messages m
    join authorized_conversations c
      on c.id = m.conversation_id
    where m.deleted_at is null
    order by m.conversation_id, m.created_at desc, m.id desc
  ),
  unread_counts as (
    select
      m.conversation_id,
      count(*)::bigint as unread_count
    from public.messages m
    join authorized_conversations c
      on c.id = m.conversation_id
    where m.deleted_at is null
      and m.sender_id <> c.viewer_id
      and (c.last_read_at is null or m.created_at > c.last_read_at)
    group by m.conversation_id
  )
  select
    c.id,
    c.type,
    c.name,
    c.photo_url,
    c.event_id,
    c.created_by,
    c.created_at,
    c.updated_at,
    coalesce(cm.members, '[]'::jsonb) as members,
    case
      when lm.id is null then null
      else jsonb_build_object(
        'id', lm.id,
        'content', lm.content,
        'sender_id', lm.sender_id,
        'created_at', lm.created_at
      )
    end as last_message,
    coalesce(uc.unread_count, 0::bigint) as unread_count
  from authorized_conversations c
  left join conversation_members cm
    on cm.conversation_id = c.id
  left join last_messages lm
    on lm.conversation_id = c.id
  left join unread_counts uc
    on uc.conversation_id = c.id
  order by greatest(
    coalesce(c.updated_at, '-infinity'::timestamptz),
    coalesce(lm.created_at, '-infinity'::timestamptz),
    coalesce(c.created_at, '-infinity'::timestamptz)
  ) desc, c.id;
$$;

revoke all on function public.get_conversations() from public;
revoke all on function public.get_conversations() from anon;
grant execute on function public.get_conversations() to authenticated;

comment on function public.get_conversations() is
  'Returns the current user organization-scoped conversation list with members, last message, and unread counts.';

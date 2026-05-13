-- Allow @everyone in chats to mention every other member in the conversation.

create or replace function public.extract_conversation_mentions(
  p_text text,
  p_conversation_id uuid,
  p_sender_id uuid default null
)
returns table(user_id uuid)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with mention_tokens as (
    select distinct lower(regexp_replace(m[1], '[,.;:!?]+$', '')) as mention_key
    from regexp_matches(coalesce(p_text, ''), '@([^[:space:]]+)', 'g') as m
  ),
  everyone_mentions as (
    select cm.user_id
    from mention_tokens mt
    join public.conversation_members cm
      on cm.conversation_id = p_conversation_id
    where mt.mention_key = 'everyone'
      and cm.user_id <> coalesce(p_sender_id, cm.user_id)
  ),
  profile_mentions as (
    select cm.user_id
    from mention_tokens mt
    join public.conversation_members cm
      on cm.conversation_id = p_conversation_id
    join public.profiles p
      on p.id = cm.user_id
    where mt.mention_key <> 'everyone'
      and cm.user_id <> coalesce(p_sender_id, cm.user_id)
      and lower(
        regexp_replace(
          trim(concat_ws('_', coalesce(p.first_name, ''), coalesce(p.last_name, ''))),
          '\s+',
          '_',
          'g'
        )
      ) = mt.mention_key
  )
  select distinct user_id from everyone_mentions
  union
  select distinct user_id from profile_mentions;
$$;

grant execute on function public.extract_conversation_mentions(text, uuid, uuid) to authenticated;

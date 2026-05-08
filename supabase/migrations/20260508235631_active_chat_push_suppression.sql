create table if not exists public.active_conversation_views (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  org_id uuid references public.organizations(id) on delete restrict
);

create index if not exists active_conversation_views_conversation_seen_idx
  on public.active_conversation_views (conversation_id, last_seen_at desc);

alter table public.active_conversation_views enable row level security;

drop policy if exists "Users can view own active conversation" on public.active_conversation_views;
drop policy if exists "Users can update own active conversation" on public.active_conversation_views;

create policy "Users can view own active conversation"
  on public.active_conversation_views for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can update own active conversation"
  on public.active_conversation_views for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.set_active_conversation(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id uuid := auth.uid();
  v_org_id uuid;
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

  insert into public.active_conversation_views (user_id, conversation_id, last_seen_at, org_id)
  values (caller_id, p_conversation_id, now(), v_org_id)
  on conflict (user_id) do update
    set conversation_id = excluded.conversation_id,
        last_seen_at = excluded.last_seen_at,
        org_id = excluded.org_id;
end;
$$;

create or replace function public.clear_active_conversation(p_conversation_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    return;
  end if;

  delete from public.active_conversation_views acv
  where acv.user_id = caller_id
    and (p_conversation_id is null or acv.conversation_id = p_conversation_id);
end;
$$;

create or replace function public.chat_message_preview(p_content text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  parsed jsonb;
  text_value text;
begin
  begin
    parsed := p_content::jsonb;
  exception
    when others then
      return left(coalesce(nullif(trim(p_content), ''), 'Sent a message'), 100);
  end;

  if parsed->>'type' = 'image' then
    return 'Sent a photo';
  end if;

  if parsed->>'type' = 'delete_request' then
    return 'Requested to delete this chat';
  end if;

  text_value := nullif(trim(p_content), '');
  return left(coalesce(text_value, 'Sent a message'), 100);
end;
$$;

create or replace function public.on_message_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sender_name text;
  v_conversation public.conversations%rowtype;
  v_member record;
  v_notification_title text;
  v_notification_body text;
  v_notification_url text;
begin
  select coalesce(nullif(p.nickname, ''), nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Someone')
  into v_sender_name
  from public.profiles p
  where p.id = new.sender_id;

  select *
  into v_conversation
  from public.conversations
  where id = new.conversation_id;

  if v_conversation.id is null then
    return new;
  end if;

  if v_conversation.type = 'event' then
    v_notification_url := '/messages/' || new.conversation_id;
    select coalesce(title, 'Event Discussion')
    into v_notification_title
    from public.events
    where id = v_conversation.event_id;
  elsif v_conversation.type = 'personal' then
    v_notification_url := '/messages/' || new.conversation_id;
    v_notification_title := v_sender_name;
  else
    v_notification_url := '/messages/' || new.conversation_id;
    v_notification_title := coalesce(nullif(v_conversation.name, ''), 'Group Chat');
  end if;

  v_notification_body := v_sender_name || ': ' || public.chat_message_preview(new.content);

  for v_member in
    select cm.user_id, cm.org_id
    from public.conversation_members cm
    where cm.conversation_id = new.conversation_id
      and cm.user_id <> new.sender_id
      and not exists (
        select 1
        from public.active_conversation_views acv
        where acv.user_id = cm.user_id
          and acv.conversation_id = new.conversation_id
          and acv.last_seen_at > now() - interval '45 seconds'
      )
  loop
    insert into public.notifications (user_id, org_id, type, title, body, data)
    values (
      v_member.user_id,
      coalesce(v_member.org_id, v_conversation.org_id),
      'message',
      v_notification_title,
      v_notification_body,
      jsonb_build_object(
        'url', v_notification_url,
        'conversation_id', new.conversation_id,
        'message_id', new.id,
        'sender_id', new.sender_id
      )
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_message_created on public.messages;

create trigger trg_message_created
  after insert on public.messages
  for each row
  execute function public.on_message_created();

grant execute on function public.set_active_conversation(uuid) to authenticated;
grant execute on function public.clear_active_conversation(uuid) to authenticated;
grant execute on function public.chat_message_preview(text) to authenticated;

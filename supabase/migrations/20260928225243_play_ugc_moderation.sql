-- Private-pilot moderation. A block affects one-to-one chat only; church
-- announcements, event chat, and group chat remain available.
create table public.user_blocks (
  org_id uuid not null references public.organizations(id),
  blocker_id uuid not null references public.profiles(id),
  blocked_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (org_id, blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index user_blocks_blocked_idx on public.user_blocks (org_id, blocked_id, blocker_id);
alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from anon, authenticated;
grant select, insert, delete on public.user_blocks to authenticated;

create policy "Members view own blocks" on public.user_blocks
  for select to authenticated
  using (org_id = public.auth_org_id() and blocker_id = (select auth.uid()));
create policy "Members block a person in their church" on public.user_blocks
  for insert to authenticated
  with check (
    org_id = public.auth_org_id()
    and blocker_id = (select auth.uid())
    and exists (select 1 from public.profiles where id = blocked_id and org_id = public.auth_org_id())
  );
create policy "Members remove own blocks" on public.user_blocks
  for delete to authenticated
  using (org_id = public.auth_org_id() and blocker_id = (select auth.uid()));

-- Run after member or message RLS as well: direct API calls and old clients
-- must not bypass a member's block. This trigger does not alter shared chats.
create function public.prevent_blocked_personal_interaction()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_org_id uuid;
  v_actor uuid;
  v_personal boolean;
begin
  if tg_table_name = 'conversation_members' then
    v_actor := new.user_id;
    select c.org_id, c.type = 'personal' into v_org_id, v_personal
      from public.conversations c where c.id = new.conversation_id;
    if v_personal and exists (
      select 1 from public.conversation_members cm
      join public.user_blocks b on b.org_id = v_org_id
        and ((b.blocker_id = v_actor and b.blocked_id = cm.user_id)
          or (b.blocked_id = v_actor and b.blocker_id = cm.user_id))
      where cm.conversation_id = new.conversation_id
    ) then
      raise exception 'Direct messaging is unavailable for this person';
    end if;
  elsif tg_table_name = 'messages' then
    v_actor := new.sender_id;
    select c.org_id, c.type = 'personal' into v_org_id, v_personal
      from public.conversations c where c.id = new.conversation_id;
    if v_personal and exists (
      select 1 from public.conversation_members cm
      join public.user_blocks b on b.org_id = v_org_id
        and ((b.blocker_id = v_actor and b.blocked_id = cm.user_id)
          or (b.blocked_id = v_actor and b.blocker_id = cm.user_id))
      where cm.conversation_id = new.conversation_id
    ) then
      raise exception 'Direct messaging is unavailable for this person';
    end if;
  elsif tg_table_name = 'message_reactions' then
    v_actor := new.user_id;
    select c.org_id, c.type = 'personal' into v_org_id, v_personal
      from public.messages m join public.conversations c on c.id = m.conversation_id
      where m.id = new.message_id;
    if v_personal and exists (
      select 1 from public.messages m
      join public.conversation_members cm on cm.conversation_id = m.conversation_id
      join public.user_blocks b on b.org_id = v_org_id
        and ((b.blocker_id = v_actor and b.blocked_id = cm.user_id)
          or (b.blocked_id = v_actor and b.blocker_id = cm.user_id))
      where m.id = new.message_id
    ) then
      raise exception 'Direct messaging is unavailable for this person';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.prevent_blocked_personal_interaction() from public, anon, authenticated;
create trigger conversation_members_prevent_blocked_personal
  before insert on public.conversation_members for each row
  execute function public.prevent_blocked_personal_interaction();
create trigger messages_prevent_blocked_personal
  before insert on public.messages for each row
  execute function public.prevent_blocked_personal_interaction();
create trigger reactions_prevent_blocked_personal
  before insert on public.message_reactions for each row
  execute function public.prevent_blocked_personal_interaction();

-- Report identifiers are validated server-side. Only the reporter can read
-- their report through the app; the platform operator reviews the queue with
-- service-role access, which is never sent to a browser.
create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  reporter_id uuid not null references public.profiles(id),
  kind text not null check (kind in ('user', 'message', 'announcement', 'announcement_comment', 'event_message')),
  subject_id uuid not null,
  reason text not null check (reason in ('harassment', 'sexual_content', 'violence', 'spam', 'other')),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  review_note text
);
create index content_reports_queue_idx on public.content_reports (status, created_at desc);
alter table public.content_reports enable row level security;
revoke all on public.content_reports from anon, authenticated;
grant select, insert on public.content_reports to authenticated;

create policy "Reporters view own reports" on public.content_reports
  for select to authenticated
  using (org_id = public.auth_org_id() and reporter_id = (select auth.uid()));
create policy "Members submit reports" on public.content_reports
  for insert to authenticated
  with check (
    org_id = public.auth_org_id()
    and reporter_id = (select auth.uid())
    and status = 'pending' and reviewed_at is null and review_note is null
  );

create function public.validate_content_report()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.reporter_id is distinct from auth.uid()
    or new.org_id is distinct from public.auth_org_id() then
    raise exception 'Report must belong to your church';
  end if;

  if new.kind = 'user' then
    if not exists (select 1 from public.profiles p
      where p.id = new.subject_id and p.org_id = new.org_id and p.id <> new.reporter_id) then
      raise exception 'Person is unavailable for reporting';
    end if;
  elsif new.kind = 'message' then
    if not exists (select 1 from public.messages m
      where m.id = new.subject_id and m.org_id = new.org_id
        and public.is_conversation_member(m.conversation_id, new.reporter_id)) then
      raise exception 'Message is unavailable for reporting';
    end if;
  elsif new.kind = 'announcement' then
    if not exists (select 1 from public.announcements a
      where a.id = new.subject_id and a.org_id = new.org_id) then
      raise exception 'Announcement is unavailable for reporting';
    end if;
  elsif new.kind = 'announcement_comment' then
    if not exists (select 1 from public.announcement_comments c
      join public.announcements a on a.id = c.announcement_id
      where c.id = new.subject_id and c.org_id = new.org_id and a.org_id = new.org_id) then
      raise exception 'Comment is unavailable for reporting';
    end if;
  elsif new.kind = 'event_message' then
    if not exists (select 1 from public.event_messages e
      where e.id = new.subject_id and e.org_id = new.org_id) then
      raise exception 'Event message is unavailable for reporting';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.validate_content_report() from public, anon, authenticated;
create trigger content_reports_validate before insert on public.content_reports
  for each row execute function public.validate_content_report();

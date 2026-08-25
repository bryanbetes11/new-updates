-- Enable safe self-service church creation and close the remaining messaging
-- tenant-isolation gaps before a second organization can be provisioned.

-- ---------------------------------------------------------------------------
-- Backfill the legacy messaging rows that pre-date the multi-tenant cutover.
-- ---------------------------------------------------------------------------

update public.conversations c
set org_id = e.org_id
from public.events e
where e.id = c.event_id
  and c.org_id is null;

update public.conversations c
set org_id = creator.org_id
from public.profiles creator
where creator.id = c.created_by
  and creator.org_id is not null
  and c.org_id is null;

-- A deleted creator can leave an old conversation without a creator profile.
update public.conversations c
set org_id = (
  select p.org_id
  from public.conversation_members cm
  join public.profiles p on p.id = cm.user_id
  where cm.conversation_id = c.id
    and p.org_id is not null
  limit 1
)
where c.org_id is null;

update public.conversation_members cm
set org_id = c.org_id
from public.conversations c
where c.id = cm.conversation_id
  and cm.org_id is null;

update public.messages m
set org_id = c.org_id
from public.conversations c
where c.id = m.conversation_id
  and m.org_id is null;

update public.message_reactions mr
set org_id = m.org_id
from public.messages m
where m.id = mr.message_id
  and mr.org_id is null;

update public.active_conversation_views acv
set org_id = c.org_id
from public.conversations c
where c.id = acv.conversation_id
  and acv.org_id is null;

update public.event_messages em
set org_id = e.org_id
from public.events e
where e.id = em.event_id
  and em.org_id is null;

do $$
begin
  if exists (select 1 from public.conversations where org_id is null)
    or exists (select 1 from public.conversation_members where org_id is null)
    or exists (select 1 from public.messages where org_id is null)
    or exists (select 1 from public.message_reactions where org_id is null)
    or exists (select 1 from public.active_conversation_views where org_id is null)
    or exists (select 1 from public.event_messages where org_id is null)
  then
    raise exception 'Messaging tenant backfill is incomplete';
  end if;
end;
$$;

alter table public.conversations alter column org_id set not null;
alter table public.conversation_members alter column org_id set not null;
alter table public.messages alter column org_id set not null;
alter table public.message_reactions alter column org_id set not null;
alter table public.active_conversation_views alter column org_id set not null;
alter table public.event_messages alter column org_id set not null;
alter table public.activity_logs alter column org_id set not null;
alter table public.song_section_notes alter column org_id set not null;

-- Composite foreign keys make a child row unable to point at a parent from a
-- different church even when a privileged function or future policy is wrong.
create unique index if not exists conversations_id_org_id_key
  on public.conversations (id, org_id);
create unique index if not exists messages_id_org_id_key
  on public.messages (id, org_id);
create unique index if not exists events_id_org_id_key
  on public.events (id, org_id);

alter table public.conversation_members
  drop constraint if exists conversation_members_conversation_org_fkey;
alter table public.conversation_members
  add constraint conversation_members_conversation_org_fkey
  foreign key (conversation_id, org_id)
  references public.conversations (id, org_id) on delete cascade;

alter table public.messages
  drop constraint if exists messages_conversation_org_fkey;
alter table public.messages
  add constraint messages_conversation_org_fkey
  foreign key (conversation_id, org_id)
  references public.conversations (id, org_id) on delete cascade;

alter table public.message_reactions
  drop constraint if exists message_reactions_message_org_fkey;
alter table public.message_reactions
  add constraint message_reactions_message_org_fkey
  foreign key (message_id, org_id)
  references public.messages (id, org_id) on delete cascade;

alter table public.active_conversation_views
  drop constraint if exists active_conversation_views_conversation_org_fkey;
alter table public.active_conversation_views
  add constraint active_conversation_views_conversation_org_fkey
  foreign key (conversation_id, org_id)
  references public.conversations (id, org_id) on delete cascade;

alter table public.event_messages
  drop constraint if exists event_messages_event_org_fkey;
alter table public.event_messages
  add constraint event_messages_event_org_fkey
  foreign key (event_id, org_id)
  references public.events (id, org_id) on delete cascade;

-- ---------------------------------------------------------------------------
-- Derive tenant metadata in the database. Clients never get to choose it.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_conversation_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator_org_id uuid;
  v_event_org_id uuid;
begin
  if tg_op = 'UPDATE' then
    if new.org_id is distinct from old.org_id then
      raise exception 'Conversation church cannot be changed';
    end if;

    if new.event_id is not null then
      select org_id into v_event_org_id
      from public.events
      where id = new.event_id;

      if v_event_org_id is null or v_event_org_id <> old.org_id then
        raise exception 'Event is outside the conversation church';
      end if;
    end if;

    new.org_id := old.org_id;
    return new;
  end if;

  select org_id into v_creator_org_id
  from public.profiles
  where id = new.created_by;

  if v_creator_org_id is null then
    raise exception 'Conversation creator must belong to a church';
  end if;

  if new.event_id is not null then
    select org_id into v_event_org_id
    from public.events
    where id = new.event_id;

    if v_event_org_id is null or v_event_org_id <> v_creator_org_id then
      raise exception 'Event is outside the conversation creator church';
    end if;
  end if;

  new.org_id := v_creator_org_id;
  return new;
end;
$$;

create or replace function public.enforce_conversation_member_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_org_id uuid;
  v_member_org_id uuid;
begin
  if tg_op = 'UPDATE' then
    if new.conversation_id is distinct from old.conversation_id
      or new.sender_id is distinct from old.sender_id
      or new.org_id is distinct from old.org_id
    then
      raise exception 'Message tenant metadata cannot be changed';
    end if;

    if new.reply_to is not null and not exists (
      select 1 from public.messages reply
      where reply.id = new.reply_to
        and reply.conversation_id = old.conversation_id
        and reply.org_id = old.org_id
    ) then
      raise exception 'Reply target is outside this conversation';
    end if;

    new.org_id := old.org_id;
    return new;
  end if;

  select org_id into v_conversation_org_id
  from public.conversations
  where id = new.conversation_id;

  select org_id into v_member_org_id
  from public.profiles
  where id = new.user_id;

  if v_conversation_org_id is null
    or v_member_org_id is null
    or v_member_org_id <> v_conversation_org_id
  then
    raise exception 'Conversation member must belong to the same church';
  end if;

  if tg_op = 'UPDATE' and (
    new.conversation_id is distinct from old.conversation_id
    or new.user_id is distinct from old.user_id
    or new.org_id is distinct from old.org_id
  ) then
    raise exception 'Conversation membership identity cannot be changed';
  end if;

  new.org_id := v_conversation_org_id;
  return new;
end;
$$;

create or replace function public.enforce_message_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_org_id uuid;
  v_sender_org_id uuid;
begin
  select org_id into v_conversation_org_id
  from public.conversations
  where id = new.conversation_id;

  select org_id into v_sender_org_id
  from public.profiles
  where id = new.sender_id;

  if v_conversation_org_id is null
    or v_sender_org_id is null
    or v_sender_org_id <> v_conversation_org_id
  then
    raise exception 'Message sender must belong to the conversation church';
  end if;

  if new.reply_to is not null and not exists (
    select 1 from public.messages reply
    where reply.id = new.reply_to
      and reply.conversation_id = new.conversation_id
      and reply.org_id = v_conversation_org_id
  ) then
    raise exception 'Reply target is outside this conversation';
  end if;

  new.org_id := v_conversation_org_id;
  return new;
end;
$$;

create or replace function public.enforce_message_reaction_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message_org_id uuid;
  v_user_org_id uuid;
begin
  select org_id into v_message_org_id
  from public.messages
  where id = new.message_id;

  select org_id into v_user_org_id
  from public.profiles
  where id = new.user_id;

  if v_message_org_id is null
    or v_user_org_id is null
    or v_user_org_id <> v_message_org_id
  then
    raise exception 'Reaction user must belong to the message church';
  end if;

  new.org_id := v_message_org_id;
  return new;
end;
$$;

create or replace function public.enforce_active_conversation_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_org_id uuid;
  v_user_org_id uuid;
begin
  select org_id into v_conversation_org_id
  from public.conversations
  where id = new.conversation_id;

  select org_id into v_user_org_id
  from public.profiles
  where id = new.user_id;

  if v_conversation_org_id is null
    or v_user_org_id is null
    or v_user_org_id <> v_conversation_org_id
    or not exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = new.conversation_id
        and cm.user_id = new.user_id
        and cm.org_id = v_conversation_org_id
    )
  then
    raise exception 'Active conversation must be a same-church membership';
  end if;

  new.org_id := v_conversation_org_id;
  return new;
end;
$$;

create or replace function public.enforce_event_message_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_org_id uuid;
  v_user_org_id uuid;
begin
  select org_id into v_event_org_id from public.events where id = new.event_id;
  select org_id into v_user_org_id from public.profiles where id = new.user_id;

  if v_event_org_id is null
    or v_user_org_id is null
    or v_user_org_id <> v_event_org_id
  then
    raise exception 'Event message author must belong to the event church';
  end if;

  new.org_id := v_event_org_id;
  return new;
end;
$$;

revoke all on function public.enforce_conversation_tenant() from public, anon, authenticated;
revoke all on function public.enforce_conversation_member_tenant() from public, anon, authenticated;
revoke all on function public.enforce_message_tenant() from public, anon, authenticated;
revoke all on function public.enforce_message_reaction_tenant() from public, anon, authenticated;
revoke all on function public.enforce_active_conversation_tenant() from public, anon, authenticated;
revoke all on function public.enforce_event_message_tenant() from public, anon, authenticated;

drop trigger if exists conversations_enforce_tenant on public.conversations;
create trigger conversations_enforce_tenant
before insert or update on public.conversations
for each row execute function public.enforce_conversation_tenant();

drop trigger if exists conversation_members_enforce_tenant on public.conversation_members;
create trigger conversation_members_enforce_tenant
before insert or update on public.conversation_members
for each row execute function public.enforce_conversation_member_tenant();

drop trigger if exists messages_enforce_tenant on public.messages;
create trigger messages_enforce_tenant
before insert or update on public.messages
for each row execute function public.enforce_message_tenant();

drop trigger if exists message_reactions_enforce_tenant on public.message_reactions;
create trigger message_reactions_enforce_tenant
before insert or update on public.message_reactions
for each row execute function public.enforce_message_reaction_tenant();

drop trigger if exists active_conversation_views_enforce_tenant on public.active_conversation_views;
create trigger active_conversation_views_enforce_tenant
before insert or update on public.active_conversation_views
for each row execute function public.enforce_active_conversation_tenant();

drop trigger if exists event_messages_enforce_tenant on public.event_messages;
create trigger event_messages_enforce_tenant
before insert or update on public.event_messages
for each row execute function public.enforce_event_message_tenant();

-- ---------------------------------------------------------------------------
-- Tenant-aware messaging authorization.
-- ---------------------------------------------------------------------------

create or replace function public.is_conversation_member(conv_id uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_members cm
    join public.conversations c on c.id = cm.conversation_id and c.org_id = cm.org_id
    join public.profiles p on p.id = cm.user_id and p.org_id = cm.org_id
    where cm.conversation_id = conv_id
      and cm.user_id = uid
  );
$$;

revoke all on function public.is_conversation_member(uuid, uuid) from public, anon;
grant execute on function public.is_conversation_member(uuid, uuid) to authenticated;

drop policy if exists "Authenticated users can create conversations" on public.conversations;
drop policy if exists "Members can view their conversations" on public.conversations;
drop policy if exists "Creator can update conversation" on public.conversations;
drop policy if exists "Creator can delete conversation" on public.conversations;

create policy "Members can view same-church conversations"
  on public.conversations for select to authenticated
  using (org_id = public.auth_org_id() and public.is_conversation_member(id, (select auth.uid())));

create policy "Users can create conversations in own church"
  on public.conversations for insert to authenticated
  with check (
    org_id = public.auth_org_id()
    and created_by = (select auth.uid())
  );

create policy "Creators can update same-church conversations"
  on public.conversations for update to authenticated
  using (org_id = public.auth_org_id() and created_by = (select auth.uid()))
  with check (org_id = public.auth_org_id() and created_by = (select auth.uid()));

create policy "Creators can delete same-church conversations"
  on public.conversations for delete to authenticated
  using (org_id = public.auth_org_id() and created_by = (select auth.uid()));

drop policy if exists "Users can view members of joined conversations" on public.conversation_members;
drop policy if exists "Members can add users to conversations" on public.conversation_members;
drop policy if exists "Users can update their own membership" on public.conversation_members;
drop policy if exists "Creator can remove members" on public.conversation_members;

create policy "Members can view same-church conversation members"
  on public.conversation_members for select to authenticated
  using (
    org_id = public.auth_org_id()
    and public.is_conversation_member(conversation_id, (select auth.uid()))
  );

create policy "Members can add same-church conversation members"
  on public.conversation_members for insert to authenticated
  with check (
    org_id = public.auth_org_id()
    and public.is_conversation_member(conversation_id, (select auth.uid()))
    and exists (
      select 1 from public.profiles p
      where p.id = user_id and p.org_id = public.auth_org_id()
    )
  );

create policy "Users can update own same-church membership"
  on public.conversation_members for update to authenticated
  using (org_id = public.auth_org_id() and user_id = (select auth.uid()))
  with check (org_id = public.auth_org_id() and user_id = (select auth.uid()));

create policy "Members can leave or creators can remove same-church members"
  on public.conversation_members for delete to authenticated
  using (
    org_id = public.auth_org_id()
    and (
      user_id = (select auth.uid())
      or exists (
        select 1 from public.conversations c
        where c.id = conversation_id
          and c.org_id = public.auth_org_id()
          and c.created_by = (select auth.uid())
      )
    )
  );

drop policy if exists "Members can view messages in their conversations" on public.messages;
drop policy if exists "Members can send messages to their conversations" on public.messages;
drop policy if exists "Members can update message metadata in their conversations" on public.messages;
drop policy if exists "Sender can delete own messages" on public.messages;

create policy "Members can view same-church messages"
  on public.messages for select to authenticated
  using (org_id = public.auth_org_id() and public.is_conversation_member(conversation_id, (select auth.uid())));

create policy "Members can send same-church messages"
  on public.messages for insert to authenticated
  with check (
    org_id = public.auth_org_id()
    and sender_id = (select auth.uid())
    and public.is_conversation_member(conversation_id, (select auth.uid()))
  );

create policy "Members can update same-church message metadata"
  on public.messages for update to authenticated
  using (org_id = public.auth_org_id() and public.is_conversation_member(conversation_id, (select auth.uid())))
  with check (org_id = public.auth_org_id() and public.is_conversation_member(conversation_id, (select auth.uid())));

create policy "Senders can delete own same-church messages"
  on public.messages for delete to authenticated
  using (org_id = public.auth_org_id() and sender_id = (select auth.uid()));

drop policy if exists "Conversation members can view reactions" on public.message_reactions;
drop policy if exists "Users can add reactions" on public.message_reactions;
drop policy if exists "Users can remove own reactions" on public.message_reactions;

create policy "Members can view same-church reactions"
  on public.message_reactions for select to authenticated
  using (
    org_id = public.auth_org_id()
    and exists (
      select 1 from public.messages m
      where m.id = message_id
        and m.org_id = public.auth_org_id()
        and public.is_conversation_member(m.conversation_id, (select auth.uid()))
    )
  );

create policy "Members can add same-church reactions"
  on public.message_reactions for insert to authenticated
  with check (
    org_id = public.auth_org_id()
    and user_id = (select auth.uid())
    and exists (
      select 1 from public.messages m
      where m.id = message_id
        and m.org_id = public.auth_org_id()
        and public.is_conversation_member(m.conversation_id, (select auth.uid()))
    )
  );

create policy "Users can remove own same-church reactions"
  on public.message_reactions for delete to authenticated
  using (org_id = public.auth_org_id() and user_id = (select auth.uid()));

drop policy if exists "Users can view own active conversation" on public.active_conversation_views;
drop policy if exists "Users can update own active conversation" on public.active_conversation_views;

create policy "Users can manage own same-church active conversation"
  on public.active_conversation_views for all to authenticated
  using (org_id = public.auth_org_id() and user_id = (select auth.uid()))
  with check (
    org_id = public.auth_org_id()
    and user_id = (select auth.uid())
    and public.is_conversation_member(conversation_id, (select auth.uid()))
  );

drop policy if exists "Authenticated users can read event messages" on public.event_messages;
drop policy if exists "Users can insert their own event messages" on public.event_messages;
drop policy if exists "Users can delete their own event messages" on public.event_messages;
drop policy if exists "Production Directors can delete any event message" on public.event_messages;

create policy "Members can read own-church event messages"
  on public.event_messages for select to authenticated
  using (org_id = public.auth_org_id());

create policy "Members can create own-church event messages"
  on public.event_messages for insert to authenticated
  with check (org_id = public.auth_org_id() and user_id = (select auth.uid()));

create policy "Authors can delete own-church event messages"
  on public.event_messages for delete to authenticated
  using (org_id = public.auth_org_id() and user_id = (select auth.uid()));

create policy "Production directors can delete own-church event messages"
  on public.event_messages for delete to authenticated
  using (
    org_id = public.auth_org_id()
    and exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = (select auth.uid())
        and ur.org_id = public.auth_org_id()
        and r.name = 'Production Director'
    )
  );

-- ---------------------------------------------------------------------------
-- Rebuild the two general chat creation functions with hard tenant checks.
-- ---------------------------------------------------------------------------

create or replace function public.create_personal_conversation(target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  caller_org_id uuid := public.auth_org_id();
  existing_conv_id uuid;
  new_conv_id uuid;
begin
  if caller_id is null or caller_org_id is null then
    raise exception 'Church membership required';
  end if;

  if caller_id = target_user_id then
    raise exception 'Cannot create conversation with yourself';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = target_user_id and org_id = caller_org_id
  ) then
    raise exception 'Selected user is outside your church';
  end if;

  select c.id into existing_conv_id
  from public.conversations c
  join public.conversation_members cm1 on cm1.conversation_id = c.id
    and cm1.user_id = caller_id and cm1.org_id = caller_org_id
  join public.conversation_members cm2 on cm2.conversation_id = c.id
    and cm2.user_id = target_user_id and cm2.org_id = caller_org_id
  where c.type = 'personal' and c.org_id = caller_org_id
  limit 1;

  if existing_conv_id is not null then
    return existing_conv_id;
  end if;

  insert into public.conversations (type, created_by, org_id)
  values ('personal', caller_id, caller_org_id)
  returning id into new_conv_id;

  insert into public.conversation_members (conversation_id, user_id, org_id)
  values
    (new_conv_id, caller_id, caller_org_id),
    (new_conv_id, target_user_id, caller_org_id);

  return new_conv_id;
end;
$$;

create or replace function public.create_group_conversation(member_ids uuid[], group_name text default 'Group Chat')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  caller_org_id uuid := public.auth_org_id();
  new_conv_id uuid;
  member_id uuid;
begin
  if caller_id is null or caller_org_id is null then
    raise exception 'Church membership required';
  end if;

  if array_length(member_ids, 1) is null or array_length(member_ids, 1) = 0 then
    raise exception 'Must include at least one member';
  end if;

  if exists (
    select 1
    from unnest(member_ids) requested(id)
    left join public.profiles p on p.id = requested.id and p.org_id = caller_org_id
    where requested.id is not null and p.id is null
  ) then
    raise exception 'Every selected member must belong to your church';
  end if;

  insert into public.conversations (type, name, created_by, org_id)
  values ('group', left(coalesce(nullif(btrim(group_name), ''), 'Group Chat'), 120), caller_id, caller_org_id)
  returning id into new_conv_id;

  insert into public.conversation_members (conversation_id, user_id, org_id)
  values (new_conv_id, caller_id, caller_org_id);

  foreach member_id in array member_ids
  loop
    if member_id is not null and member_id <> caller_id then
      insert into public.conversation_members (conversation_id, user_id, org_id)
      values (new_conv_id, member_id, caller_org_id)
      on conflict (conversation_id, user_id) do nothing;
    end if;
  end loop;

  return new_conv_id;
end;
$$;

revoke all on function public.create_personal_conversation(uuid) from public, anon;
grant execute on function public.create_personal_conversation(uuid) to authenticated;
revoke all on function public.create_group_conversation(uuid[], text) from public, anon;
grant execute on function public.create_group_conversation(uuid[], text) to authenticated;

-- ---------------------------------------------------------------------------
-- Safe, email-verified self-service tenant provisioning.
-- ---------------------------------------------------------------------------

create or replace function public.create_organization_for_current_user(
  p_name text,
  p_slug text,
  p_logo_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_profile public.profiles%rowtype;
  v_org_id uuid;
  v_slug text;
  v_now timestamptz := now();
  v_email_confirmed_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select email_confirmed_at into v_email_confirmed_at
  from auth.users
  where id = auth.uid();

  if v_email_confirmed_at is null then
    raise exception 'Confirm your email before creating a church';
  end if;

  select * into v_profile
  from public.profiles
  where id = auth.uid()
  for update;

  if v_profile.id is null then
    raise exception 'Profile not found';
  end if;

  if v_profile.org_id is not null then
    raise exception 'Account already belongs to a church';
  end if;

  if length(btrim(coalesce(p_name, ''))) < 2 or length(btrim(p_name)) > 120 then
    raise exception 'Church name must be between 2 and 120 characters';
  end if;

  v_slug := lower(btrim(coalesce(p_slug, '')));
  if v_slug !~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$' then
    raise exception 'Church URL must be 3-40 lowercase letters, numbers, or hyphens';
  end if;

  insert into public.organizations (
    name, slug, logo_url, created_by,
    subscription_status, billing_status, billing_plan,
    payment_method, billing_interval,
    trial_started_at, trial_ends_at,
    current_period_start, current_period_end
  ) values (
    btrim(p_name), v_slug, nullif(btrim(coalesce(p_logo_url, '')), ''), auth.uid(),
    'trialing', 'trialing', 'starter_monthly',
    'manual_flexible', 'monthly',
    v_now, v_now + interval '10 days',
    v_now, v_now + interval '10 days'
  )
  returning id into v_org_id;

  update public.organizations
  set seats_purchased = 15
  where id = v_org_id;

  update public.profiles
  set org_id = v_org_id,
      is_org_admin = true,
      updated_at = v_now
  where id = auth.uid();

  insert into public.organization_policy_settings (org_id, updated_by)
  values (v_org_id, auth.uid())
  on conflict (org_id) do nothing;

  return v_org_id;
exception
  when unique_violation then
    raise exception 'That church URL is already taken';
end;
$$;

revoke all on function public.create_organization_for_current_user(text, text, text)
  from public, anon;
grant execute on function public.create_organization_for_current_user(text, text, text)
  to authenticated;

comment on function public.create_organization_for_current_user(text, text, text) is
  'Creates one email-verified church tenant for the authenticated unassigned user and starts its 10-day trial.';

-- RLS protects rows, while these grants protect sensitive columns inside an
-- otherwise editable row. Billing state and tenant membership are server-only.
revoke insert, update on public.profiles from authenticated;
grant insert (id, email, first_name) on public.profiles to authenticated;
grant update (
  first_name, second_name, middle_name, last_name, nickname, phone, birthday,
  avatar_url, is_onboarded, gender, official_join_date, updated_at
) on public.profiles to authenticated;

revoke update on public.organizations from authenticated;
grant update (name, logo_url) on public.organizations to authenticated;

create or replace function public.set_org_member_admin(
  p_member_id uuid,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_org_id uuid := public.auth_org_id();
begin
  if v_actor_id is null or v_org_id is null then
    raise exception 'Church membership required';
  end if;

  if not (public.auth_is_org_admin() or public.is_platform_owner()) then
    raise exception 'Church administrator access required';
  end if;

  if p_member_id = v_actor_id and not p_enabled then
    raise exception 'You cannot remove your own administrator access';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_member_id and org_id = v_org_id
  ) then
    raise exception 'Member not found in your church';
  end if;

  if not p_enabled
    and (select count(*) from public.profiles where org_id = v_org_id and is_org_admin) <= 1
  then
    raise exception 'A church must keep at least one administrator';
  end if;

  update public.profiles
  set is_org_admin = p_enabled, updated_at = now()
  where id = p_member_id and org_id = v_org_id;
end;
$$;

revoke all on function public.set_org_member_admin(uuid, boolean) from public, anon;
grant execute on function public.set_org_member_admin(uuid, boolean) to authenticated;

create or replace function public.submit_organization_payment(
  p_plan_code text,
  p_billing_reference text,
  p_payer_name text,
  p_payment_channel text,
  p_reference_number text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid := public.auth_org_id();
  v_submission_id uuid;
  v_amount numeric;
  v_interval text;
  v_seats integer;
  v_payment_method text;
begin
  if v_user_id is null or v_org_id is null then
    raise exception 'Church membership required';
  end if;

  if not public.auth_is_org_admin() then
    raise exception 'Church administrator access required';
  end if;

  if exists (
    select 1 from public.organizations
    where id = v_org_id and is_billing_exempt
  ) then
    raise exception 'This church is billing-exempt';
  end if;

  select plan.amount, plan.billing_interval, plan.seats
  into v_amount, v_interval, v_seats
  from (values
    ('starter_monthly'::text, 1290::numeric, 'monthly'::text, 15::integer),
    ('team_quarterly', 3480, 'quarterly', 30),
    ('church_annual', 12900, 'annual', 60)
  ) as plan(code, amount, billing_interval, seats)
  where plan.code = p_plan_code;

  if v_amount is null then
    raise exception 'Unknown billing plan';
  end if;

  if p_payment_channel not in ('gcash', 'bank_transfer') then
    raise exception 'Unsupported payment channel';
  end if;

  if length(btrim(coalesce(p_reference_number, ''))) < 3
    or length(btrim(p_reference_number)) > 120
  then
    raise exception 'A valid payment reference is required';
  end if;

  if length(btrim(coalesce(p_billing_reference, ''))) < 3
    or length(btrim(p_billing_reference)) > 120
  then
    raise exception 'A valid billing reference is required';
  end if;

  v_payment_method := case p_payment_channel
    when 'gcash' then 'manual_gcash'
    else 'manual_bank_transfer'
  end;

  update public.organizations
  set billing_plan = p_plan_code,
      billing_interval = v_interval,
      payment_method = v_payment_method,
      billing_status = 'submitted',
      seats_purchased = v_seats,
      updated_at = now()
  where id = v_org_id;

  insert into public.organization_payment_submissions (
    org_id, submitted_by, plan_code, amount, billing_reference,
    payer_name, payment_channel, reference_number, note
  ) values (
    v_org_id, v_user_id, p_plan_code, v_amount, btrim(p_billing_reference),
    nullif(btrim(coalesce(p_payer_name, '')), ''), p_payment_channel,
    btrim(p_reference_number), nullif(btrim(coalesce(p_note, '')), '')
  )
  returning id into v_submission_id;

  return v_submission_id;
end;
$$;

revoke all on function public.submit_organization_payment(text, text, text, text, text, text)
  from public, anon;
grant execute on function public.submit_organization_payment(text, text, text, text, text, text)
  to authenticated;

revoke insert, update, delete on public.organization_payment_submissions from authenticated;

notify pgrst, 'reload schema';

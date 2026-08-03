-- ============================================================================
-- ServeSync notification control center
-- ----------------------------------------------------------------------------
-- Adds tenant-level notification rules, member preferences, delivery tracking,
-- quiet hours, template overrides, deduplication, and a single push dispatcher.
-- Existing notification producers remain compatible: every INSERT into
-- public.notifications is normalized by the configuration trigger below.
-- ============================================================================

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---- Configuration tables --------------------------------------------------

create table if not exists public.notification_system_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  push_delivery_enabled boolean not null default true,
  default_timezone text not null default 'Asia/Manila',
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint notification_system_settings_timezone_not_blank
    check (length(btrim(default_timezone)) > 0)
);

create table if not exists public.notification_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  type text not null,
  label text not null,
  category text not null default 'system',
  description text not null default '',
  target_roles text[] not null default '{}',
  enabled boolean not null default true,
  required boolean not null default false,
  in_app_enabled boolean not null default true,
  push_enabled boolean not null default true,
  priority text not null default 'normal',
  reminder_offsets integer[] not null default '{}',
  template_title text,
  template_body text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, type),
  constraint notification_rules_type_not_blank check (length(btrim(type)) > 0),
  constraint notification_rules_priority_check
    check (priority in ('low', 'normal', 'high', 'urgent'))
);

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  in_app_enabled boolean not null default true,
  push_enabled boolean not null default true,
  quiet_hours_enabled boolean not null default false,
  quiet_start time not null default '21:00',
  quiet_end time not null default '07:00',
  timezone text not null default 'Asia/Manila',
  muted_types text[] not null default '{}',
  updated_at timestamptz not null default now(),
  constraint notification_preferences_timezone_not_blank
    check (length(btrim(timezone)) > 0)
);

alter table public.notification_system_settings enable row level security;
alter table public.notification_rules enable row level security;
alter table public.notification_preferences enable row level security;

drop policy if exists "Members can view same-org notification settings"
  on public.notification_system_settings;
create policy "Members can view same-org notification settings"
  on public.notification_system_settings for select
  to authenticated
  using (org_id = (select public.auth_org_id()));

drop policy if exists "Org admins can update notification settings"
  on public.notification_system_settings;
create policy "Org admins can update notification settings"
  on public.notification_system_settings for update
  to authenticated
  using (
    org_id = (select public.auth_org_id())
    and (select public.auth_is_org_admin())
  )
  with check (
    org_id = (select public.auth_org_id())
    and (select public.auth_is_org_admin())
  );

drop policy if exists "Members can view same-org notification rules"
  on public.notification_rules;
create policy "Members can view same-org notification rules"
  on public.notification_rules for select
  to authenticated
  using (org_id = (select public.auth_org_id()));

drop policy if exists "Org admins can update notification rules"
  on public.notification_rules;
create policy "Org admins can update notification rules"
  on public.notification_rules for update
  to authenticated
  using (
    org_id = (select public.auth_org_id())
    and (select public.auth_is_org_admin())
  )
  with check (
    org_id = (select public.auth_org_id())
    and (select public.auth_is_org_admin())
  );

drop policy if exists "Users can view own notification preferences"
  on public.notification_preferences;
create policy "Users can view own notification preferences"
  on public.notification_preferences for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and org_id = (select public.auth_org_id())
  );

drop policy if exists "Users can create own notification preferences"
  on public.notification_preferences;
create policy "Users can create own notification preferences"
  on public.notification_preferences for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and org_id = (select public.auth_org_id())
  );

drop policy if exists "Users can update own notification preferences"
  on public.notification_preferences;
create policy "Users can update own notification preferences"
  on public.notification_preferences for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and org_id = (select public.auth_org_id())
  )
  with check (
    user_id = (select auth.uid())
    and org_id = (select public.auth_org_id())
  );

grant select, update on public.notification_system_settings to authenticated;
grant select, update on public.notification_rules to authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant all on public.notification_system_settings to service_role;
grant all on public.notification_rules to service_role;
grant all on public.notification_preferences to service_role;

-- ---- Default rule catalog --------------------------------------------------

create or replace function private.default_notification_rules()
returns table (
  type text,
  label text,
  category text,
  description text,
  target_roles text[],
  enabled boolean,
  required boolean,
  in_app_enabled boolean,
  push_enabled boolean,
  priority text,
  reminder_offsets integer[]
)
language sql
immutable
set search_path = ''
as $$
  values
    ('assignment', 'New assignment', 'assignments', 'A member is assigned to an event role.', array['Member'], true, true, true, true, 'high', '{}'::integer[]),
    ('assignment_response', 'Assignment response', 'assignments', 'Leadership is notified when an assignment is accepted or declined.', array['Leadership'], true, false, true, true, 'normal', '{}'::integer[]),
    ('assignment_confirmation_reminder', 'Assignment confirmation reminder', 'assignments', 'A pending assignment still needs a response.', array['Member'], true, true, true, true, 'high', array[1]),
    ('assignment_removed', 'Assignment removed', 'assignments', 'A member is removed from an event assignment.', array['Member'], true, true, true, true, 'high', '{}'::integer[]),
    ('event_created', 'New event', 'events', 'Members are told when a new event is added to the calendar.', array['Members'], true, false, true, false, 'normal', '{}'::integer[]),
    ('event_updated', 'Event updated', 'events', 'Assigned members are told when important event details change.', array['Assigned members'], true, true, true, true, 'high', '{}'::integer[]),
    ('event_cancelled', 'Event cancelled', 'events', 'Assigned members are told when an event is deleted or cancelled.', array['Assigned members'], true, true, true, true, 'urgent', '{}'::integer[]),
    ('event_reminder', 'Event tomorrow', 'events', 'Assigned members receive a reminder the day before an event.', array['Assigned members'], true, false, true, true, 'normal', array[1]),
    ('event_today_reminder', 'Event today', 'events', 'Assigned members receive a reminder on the event day.', array['Assigned members'], true, true, true, true, 'high', array[0]),
    ('attendance_open', 'Attendance opened', 'attendance', 'Scheduled members are told when attendance marking opens.', array['Assigned members'], true, true, true, true, 'high', array[0]),
    ('attendance_reminder', 'Attendance reminder', 'attendance', 'Members are reminded to submit attendance.', array['Assigned members'], true, true, true, true, 'high', '{}'::integer[]),
    ('attendance_five_min_reminder', 'Attendance closes soon', 'attendance', 'Attendance closes in five minutes.', array['Assigned members'], true, true, true, true, 'high', '{}'::integer[]),
    ('attendance_grace_final_reminder', 'Attendance final reminder', 'attendance', 'The attendance grace period is about to end.', array['Assigned members'], true, true, true, true, 'urgent', '{}'::integer[]),
    ('attendance_missed_evening_reminder', 'Missed attendance reminder', 'attendance', 'A member has not submitted attendance after an event.', array['Assigned members'], true, true, true, true, 'high', '{}'::integer[]),
    ('attendance_missed_final_reminder', 'Missed attendance final reminder', 'attendance', 'A final reminder is sent for missing attendance.', array['Assigned members'], true, true, true, true, 'urgent', '{}'::integer[]),
    ('attendance_alert', 'Attendance accountability alert', 'attendance', 'Leadership is alerted when attendance thresholds are reached.', array['Leadership'], true, true, true, true, 'urgent', '{}'::integer[]),
    ('proposal_reminder', 'Proposal deadline reminder', 'deadlines', 'The event proposal deadline is approaching.', array['Leadership'], true, true, true, true, 'high', array[3, 1, 0]),
    ('proposal_overdue_alert', 'Proposal overdue', 'deadlines', 'The event proposal deadline has passed.', array['Leadership'], true, true, true, true, 'urgent', '{}'::integer[]),
    ('leadership_member_action_reminder', 'Member follow-up reminder', 'deadlines', 'Leadership has an unresolved member follow-up.', array['Leadership'], true, true, true, true, 'high', '{}'::integer[]),
    ('setlist_submitted', 'Setlist submitted', 'setlists', 'A setlist is submitted for leadership review.', array['Leadership'], true, true, true, true, 'high', '{}'::integer[]),
    ('setlist_approved', 'Setlist approved', 'setlists', 'The setlist creator is told that a setlist was approved.', array['Song Leader'], true, true, true, true, 'high', '{}'::integer[]),
    ('setlist_revision', 'Setlist revision requested', 'setlists', 'The setlist creator is asked to revise a setlist.', array['Song Leader'], true, true, true, true, 'high', '{}'::integer[]),
    ('setlist_rejected', 'Setlist rejected', 'setlists', 'The setlist creator is told that a setlist was rejected.', array['Song Leader'], true, true, true, true, 'urgent', '{}'::integer[]),
    ('setlist_changed', 'Approved setlist changed', 'setlists', 'Relevant members are told when an approved setlist changes.', array['Assigned members'], true, false, true, true, 'normal', '{}'::integer[]),
    ('announcement', 'New announcement', 'communication', 'Members are told when an announcement is published.', array['Members'], true, false, true, true, 'normal', '{}'::integer[]),
    ('comment', 'Announcement comment', 'communication', 'Announcement participants are told about a new comment.', array['Participants'], true, false, true, true, 'normal', '{}'::integer[]),
    ('mention', 'Mention', 'communication', 'A member is told when they are mentioned.', array['Mentioned member'], true, true, true, true, 'high', '{}'::integer[]),
    ('message', 'Chat message', 'communication', 'A push alert is sent for a new chat message while ServeSync is not visible.', array['Conversation members'], true, false, false, true, 'normal', '{}'::integer[]),
    ('video', 'New video', 'communication', 'Members are told when a new library video is published.', array['Members'], true, false, true, true, 'normal', '{}'::integer[]),
    ('leave_request', 'Leave request', 'requests', 'Leadership is told about a new leave request.', array['Leadership'], true, true, true, true, 'high', '{}'::integer[]),
    ('leave_response', 'Leave request response', 'requests', 'A member is told when a leave request is reviewed.', array['Member'], true, true, true, true, 'high', '{}'::integer[]),
    ('swap_request', 'Swap request', 'requests', 'A member or leader receives a schedule-swap request.', array['Member', 'Leadership'], true, true, true, true, 'high', '{}'::integer[]),
    ('swap_approved', 'Swap approved', 'requests', 'Participants are told when a schedule swap is approved.', array['Participants'], true, true, true, true, 'high', '{}'::integer[]),
    ('swap_declined', 'Swap declined', 'requests', 'Participants are told when a schedule swap is declined.', array['Participants'], true, true, true, true, 'high', '{}'::integer[]),
    ('sub_request', 'Substitute request', 'requests', 'A member or leader receives a substitute request.', array['Member', 'Leadership'], true, true, true, true, 'high', '{}'::integer[]),
    ('sub_approved', 'Substitute approved', 'requests', 'Participants are told when a substitute request is approved.', array['Participants'], true, true, true, true, 'high', '{}'::integer[]),
    ('sub_declined', 'Substitute declined', 'requests', 'Participants are told when a substitute request is declined.', array['Participants'], true, true, true, true, 'high', '{}'::integer[]),
    ('role_changed', 'Ministry role changed', 'members', 'A member is told when their ServeSync roles change.', array['Member'], true, true, true, true, 'high', '{}'::integer[]),
    ('member_joined', 'Member joined', 'members', 'Leadership is told when a member joins the organization.', array['Leadership'], true, false, true, true, 'normal', '{}'::integer[]),
    ('birthday', 'Birthday', 'members', 'Members are reminded about a teammate birthday.', array['Members'], true, false, true, false, 'low', array[0]),
    ('discipline_created', 'Conduct record created', 'accountability', 'A member is told when a conduct record requiring attention is created.', array['Member'], true, true, true, true, 'urgent', '{}'::integer[]),
    ('discipline_updated', 'Conduct record updated', 'accountability', 'A member is told when a conduct record is updated.', array['Member'], true, true, true, true, 'high', '{}'::integer[]),
    ('push_test', 'Push test', 'system', 'A test notification used to verify push delivery.', array['Admin'], true, false, true, true, 'low', '{}'::integer[])
$$;

insert into public.notification_system_settings (org_id)
select id from public.organizations
on conflict (org_id) do nothing;

insert into public.notification_rules (
  org_id, type, label, category, description, target_roles, enabled,
  required, in_app_enabled, push_enabled, priority, reminder_offsets
)
select
  organization.id, defaults.type, defaults.label, defaults.category,
  defaults.description, defaults.target_roles, defaults.enabled,
  defaults.required, defaults.in_app_enabled, defaults.push_enabled,
  defaults.priority, defaults.reminder_offsets
from public.organizations organization
cross join private.default_notification_rules() defaults
on conflict (org_id, type) do nothing;

insert into public.notification_preferences (user_id, org_id)
select id, org_id
from public.profiles
where org_id is not null
on conflict (user_id) do update set org_id = excluded.org_id;

-- ---- Notification delivery metadata ---------------------------------------

alter table public.notifications
  add column if not exists category text,
  add column if not exists priority text,
  add column if not exists required boolean,
  add column if not exists delivery_channels jsonb,
  add column if not exists scheduled_for timestamptz,
  add column if not exists dismissed_at timestamptz,
  add column if not exists push_status text,
  add column if not exists push_sent_at timestamptz,
  add column if not exists push_attempted_at timestamptz,
  add column if not exists dedupe_key text;

update public.notifications
set
  category = coalesce(category, case
    when type in ('assignment', 'assignment_response', 'assignment_confirmation_reminder', 'assignment_removed') then 'assignments'
    when type like 'attendance_%' then 'attendance'
    when type in ('proposal_reminder', 'proposal_overdue_alert', 'leadership_member_action_reminder') then 'deadlines'
    when type like 'setlist_%' then 'setlists'
    when type in ('announcement', 'comment', 'mention', 'message', 'video') then 'communication'
    when type in ('leave_request', 'leave_response', 'swap_request', 'swap_approved', 'swap_declined', 'sub_request', 'sub_approved', 'sub_declined') then 'requests'
    else 'system'
  end),
  priority = coalesce(priority, 'normal'),
  required = coalesce(required, false),
  delivery_channels = coalesce(delivery_channels, '{"in_app": true, "push": true}'::jsonb),
  scheduled_for = coalesce(scheduled_for, created_at),
  push_status = coalesce(push_status, 'legacy');

alter table public.notifications
  alter column category set default 'system',
  alter column category set not null,
  alter column priority set default 'normal',
  alter column priority set not null,
  alter column required set default false,
  alter column required set not null,
  alter column delivery_channels set default '{"in_app": true, "push": true}'::jsonb,
  alter column delivery_channels set not null,
  alter column scheduled_for set default now(),
  alter column scheduled_for set not null,
  alter column push_status set default 'pending',
  alter column push_status set not null;

alter table public.notifications
  drop constraint if exists notifications_priority_check,
  add constraint notifications_priority_check
    check (priority in ('low', 'normal', 'high', 'urgent')),
  drop constraint if exists notifications_push_status_check,
  add constraint notifications_push_status_check
    check (push_status in (
      'legacy', 'pending', 'dispatching', 'deferred', 'sent', 'partial',
      'failed', 'no_subscription', 'not_requested'
    ));

create unique index if not exists notifications_recipient_dedupe_idx
  on public.notifications(user_id, dedupe_key)
  where dedupe_key is not null;

create index if not exists notifications_push_queue_idx
  on public.notifications(scheduled_for, push_status)
  where push_status in ('pending', 'deferred', 'dispatching');

-- ---- Shared configuration helpers -----------------------------------------

create or replace function private.render_notification_template(
  p_template text,
  p_context jsonb
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_result text := p_template;
  v_pair record;
begin
  if p_template is null then return null; end if;
  for v_pair in select key, value from jsonb_each_text(coalesce(p_context, '{}'::jsonb))
  loop
    v_result := replace(v_result, '{{' || v_pair.key || '}}', v_pair.value);
  end loop;
  return v_result;
end;
$$;

create or replace function private.touch_notification_configuration()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists notification_rules_set_updated_at on public.notification_rules;
create trigger notification_rules_set_updated_at
before update on public.notification_rules
for each row execute function private.touch_notification_configuration();

drop trigger if exists notification_system_settings_set_updated_at
  on public.notification_system_settings;
create trigger notification_system_settings_set_updated_at
before update on public.notification_system_settings
for each row execute function private.touch_notification_configuration();

drop trigger if exists notification_preferences_set_updated_at
  on public.notification_preferences;
create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row execute function private.touch_notification_configuration();

create or replace function private.seed_organization_notification_configuration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notification_system_settings (org_id)
  values (new.id)
  on conflict (org_id) do nothing;

  insert into public.notification_rules (
    org_id, type, label, category, description, target_roles, enabled,
    required, in_app_enabled, push_enabled, priority, reminder_offsets
  )
  select
    new.id, defaults.type, defaults.label, defaults.category,
    defaults.description, defaults.target_roles, defaults.enabled,
    defaults.required, defaults.in_app_enabled, defaults.push_enabled,
    defaults.priority, defaults.reminder_offsets
  from private.default_notification_rules() defaults
  on conflict (org_id, type) do nothing;
  return new;
end;
$$;

drop trigger if exists organizations_seed_notification_configuration
  on public.organizations;
create trigger organizations_seed_notification_configuration
after insert on public.organizations
for each row execute function private.seed_organization_notification_configuration();

create or replace function private.seed_profile_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.org_id is not null then
    insert into public.notification_preferences (user_id, org_id, timezone)
    values (
      new.id,
      new.org_id,
      coalesce(
        (select settings.default_timezone
         from public.notification_system_settings settings
         where settings.org_id = new.org_id),
        'Asia/Manila'
      )
    )
    on conflict (user_id) do update set org_id = excluded.org_id;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_seed_notification_preferences on public.profiles;
create trigger profiles_seed_notification_preferences
after insert or update of org_id on public.profiles
for each row execute function private.seed_profile_notification_preferences();

create or replace function private.configure_notification_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule public.notification_rules%rowtype;
  v_preference public.notification_preferences%rowtype;
  v_push_delivery_enabled boolean := true;
  v_in_app boolean;
  v_push boolean;
  v_org_id uuid;
begin
  if new.org_id is null then
    select profile.org_id into v_org_id
    from public.profiles profile
    where profile.id = new.user_id;
    new.org_id := v_org_id;
  end if;

  if new.org_id is null then
    return null;
  end if;

  insert into public.notification_rules (
    org_id, type, label, category, description
  )
  values (
    new.org_id,
    new.type,
    initcap(replace(new.type, '_', ' ')),
    'system',
    'Automatically discovered notification type.'
  )
  on conflict (org_id, type) do nothing;

  select * into v_rule
  from public.notification_rules rule
  where rule.org_id = new.org_id
    and rule.type = new.type;

  if not found or not v_rule.enabled then
    return null;
  end if;

  select * into v_preference
  from public.notification_preferences preference
  where preference.user_id = new.user_id
    and preference.org_id = new.org_id;

  if not v_rule.required
    and new.type = any(coalesce(v_preference.muted_types, '{}'::text[])) then
    return null;
  end if;

  select settings.push_delivery_enabled into v_push_delivery_enabled
  from public.notification_system_settings settings
  where settings.org_id = new.org_id;

  v_in_app := v_rule.required
    or (v_rule.in_app_enabled and coalesce(v_preference.in_app_enabled, true));
  v_push := v_rule.push_enabled
    and coalesce(v_preference.push_enabled, true)
    and coalesce(v_push_delivery_enabled, true);

  if not v_in_app and not v_push then
    return null;
  end if;

  new.category := v_rule.category;
  new.priority := v_rule.priority;
  new.required := v_rule.required;
  new.delivery_channels := jsonb_build_object(
    'in_app', v_in_app,
    'push', v_push
  );
  new.scheduled_for := coalesce(new.scheduled_for, now());
  new.push_status := case when v_push then 'pending' else 'not_requested' end;
  new.dedupe_key := coalesce(new.dedupe_key, nullif(new.data ->> 'dedupe_key', ''));

  if nullif(btrim(v_rule.template_title), '') is not null then
    new.title := private.render_notification_template(v_rule.template_title, new.data);
  end if;
  if nullif(btrim(v_rule.template_body), '') is not null then
    new.body := private.render_notification_template(v_rule.template_body, new.data);
  end if;

  return new;
end;
$$;

drop trigger if exists notifications_apply_configuration on public.notifications;
create trigger notifications_apply_configuration
before insert on public.notifications
for each row execute function private.configure_notification_insert();

-- ---- Centralized push dispatcher ------------------------------------------

create or replace function private.dispatch_notification_push(p_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notification public.notifications%rowtype;
  v_webhook_secret text;
  v_request_id bigint;
begin
  select * into v_notification
  from public.notifications notification
  where notification.id = p_notification_id
  for update;

  if not found
    or not coalesce((v_notification.delivery_channels ->> 'push')::boolean, false)
    or v_notification.scheduled_for > now()
    or v_notification.push_status not in ('pending', 'deferred', 'dispatching') then
    return false;
  end if;

  select decrypted_secret into v_webhook_secret
  from vault.decrypted_secrets
  where name = 'send_push_webhook_secret';

  if v_webhook_secret is null then
    update public.notifications
    set push_status = 'failed', push_attempted_at = now()
    where id = p_notification_id;
    return false;
  end if;

  update public.notifications
  set push_status = 'dispatching', push_attempted_at = now()
  where id = p_notification_id;

  select net.http_post(
    url := 'https://uhwkrxihyqkagirdjhht.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', v_webhook_secret
    ),
    body := jsonb_build_object(
      'notification_id', v_notification.id::text,
      'user_id', v_notification.user_id::text,
      'title', v_notification.title,
      'body', v_notification.body,
      'data', coalesce(v_notification.data, '{}'::jsonb) || jsonb_build_object(
        'notification_id', v_notification.id::text,
        'notification_type', v_notification.type,
        'priority', v_notification.priority
      )
    ),
    timeout_milliseconds := 15000
  ) into v_request_id;
  return v_request_id is not null;
exception
  when others then
    update public.notifications
    set push_status = 'failed', push_attempted_at = now()
    where id = p_notification_id;
    return false;
end;
$$;

create or replace function private.dispatch_due_notification_pushes()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notification_id uuid;
  v_dispatched integer := 0;
begin
  for v_notification_id in
    select notification.id
    from public.notifications notification
    where notification.scheduled_for <= now()
      and (
        notification.push_status in ('pending', 'deferred')
        or (
          notification.push_status = 'dispatching'
          and notification.push_attempted_at < now() - interval '5 minutes'
        )
      )
    order by notification.scheduled_for, notification.created_at
    limit 100
    for update skip locked
  loop
    if private.dispatch_notification_push(v_notification_id) then
      v_dispatched := v_dispatched + 1;
    end if;
  end loop;
  return v_dispatched;
end;
$$;

create or replace function public.trigger_push_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.dispatch_notification_push(new.id);
  return new;
end;
$$;

drop trigger if exists trg_send_push_notification on public.notifications;
create trigger trg_send_push_notification
after insert on public.notifications
for each row execute function public.trigger_push_notification();

revoke all on function public.trigger_push_notification() from public, anon, authenticated;
revoke all on function private.dispatch_notification_push(uuid) from public, anon, authenticated;
revoke all on function private.dispatch_due_notification_pushes() from public, anon, authenticated;
revoke all on function private.configure_notification_insert() from public, anon, authenticated;
revoke all on function private.seed_organization_notification_configuration() from public, anon, authenticated;
revoke all on function private.seed_profile_notification_preferences() from public, anon, authenticated;
revoke all on function private.touch_notification_configuration() from public, anon, authenticated;
revoke all on function private.default_notification_rules() from public, anon, authenticated;
revoke all on function private.render_notification_template(text, jsonb) from public, anon, authenticated;

do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'servesync-dispatch-notification-pushes';

  perform cron.schedule(
    'servesync-dispatch-notification-pushes',
    '* * * * *',
    'select private.dispatch_due_notification_pushes();'
  );
end;
$$;

-- ---- Missing high-value notification producers ----------------------------

create or replace function private.notify_event_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient_id uuid;
begin
  if row(old.title, old.event_date, old.start_time, old.end_time, old.event_type)
    is not distinct from
    row(new.title, new.event_date, new.start_time, new.end_time, new.event_type) then
    return new;
  end if;

  for v_recipient_id in
    select distinct assignment.user_id
    from public.event_assignments assignment
    where assignment.event_id = new.id
      and assignment.user_id <> coalesce((select auth.uid()), new.created_by)
  loop
    perform public.create_notification(
      v_recipient_id,
      'event_updated',
      'Event Updated',
      new.title || ' has updated schedule details for '
        || to_char(new.event_date, 'FMMonth FMDD, YYYY') || '.',
      jsonb_build_object(
        'event_id', new.id::text,
        'event_title', new.title,
        'event_date', to_char(new.event_date, 'FMMonth FMDD, YYYY'),
        'url', '/events/' || new.id::text
      )
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists events_create_update_notifications on public.events;
create trigger events_create_update_notifications
after update of title, event_date, start_time, end_time, event_type on public.events
for each row execute function private.notify_event_change();

create or replace function private.notify_event_cancelled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient_id uuid;
begin
  for v_recipient_id in
    select distinct assignment.user_id
    from public.event_assignments assignment
    where assignment.event_id = old.id
  loop
    perform public.create_notification(
      v_recipient_id,
      'event_cancelled',
      'Event Cancelled',
      old.title || ' on ' || to_char(old.event_date, 'FMMonth FMDD, YYYY')
        || ' has been cancelled.',
      jsonb_build_object(
        'event_title', old.title,
        'event_date', to_char(old.event_date, 'FMMonth FMDD, YYYY'),
        'url', '/events'
      )
    );
  end loop;
  return old;
end;
$$;

drop trigger if exists events_create_cancellation_notifications on public.events;
create trigger events_create_cancellation_notifications
before delete on public.events
for each row execute function private.notify_event_cancelled();

create or replace function private.notify_assignment_removed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_role_name text;
begin
  if pg_trigger_depth() > 1 then return old; end if;

  select * into v_event from public.events where id = old.event_id;
  select name into v_role_name from public.roles where id = old.role_id;
  if v_event.id is null then return old; end if;

  perform public.create_notification(
    old.user_id,
    'assignment_removed',
    'Assignment Removed',
    'Your ' || coalesce(v_role_name, 'team') || ' assignment for '
      || v_event.title || ' has been removed.',
    jsonb_build_object(
      'event_id', old.event_id::text,
      'event_title', v_event.title,
      'role_name', coalesce(v_role_name, 'Team'),
      'url', '/events/' || old.event_id::text
    )
  );
  return old;
end;
$$;

drop trigger if exists event_assignments_create_removal_notifications
  on public.event_assignments;
create trigger event_assignments_create_removal_notifications
before delete on public.event_assignments
for each row execute function private.notify_assignment_removed();

create or replace function private.notify_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_role_id uuid;
  v_role_name text;
  v_action text := case when tg_op = 'INSERT' then 'added' else 'removed' end;
begin
  if tg_op = 'DELETE' then
    v_user_id := old.user_id;
    v_role_id := old.role_id;
  else
    v_user_id := new.user_id;
    v_role_id := new.role_id;
  end if;

  select name into v_role_name from public.roles where id = v_role_id;
  perform public.create_notification(
    v_user_id,
    'role_changed',
    'Ministry Role Updated',
    coalesce(v_role_name, 'A ministry role') || ' was ' || v_action
      || ' on your ServeSync profile.',
    jsonb_build_object(
      'role_name', coalesce(v_role_name, 'Ministry role'),
      'action', v_action,
      'url', '/profile'
    )
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists user_roles_create_change_notifications on public.user_roles;
create trigger user_roles_create_change_notifications
after insert or delete on public.user_roles
for each row execute function private.notify_role_change();

revoke all on function private.notify_event_change() from public, anon, authenticated;
revoke all on function private.notify_event_cancelled() from public, anon, authenticated;
revoke all on function private.notify_assignment_removed() from public, anon, authenticated;
revoke all on function private.notify_role_change() from public, anon, authenticated;

-- Keep notification configuration live in clients.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notification_rules'
  ) then
    alter publication supabase_realtime add table public.notification_rules;
  end if;
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notification_system_settings'
  ) then
    alter publication supabase_realtime add table public.notification_system_settings;
  end if;
end;
$$;

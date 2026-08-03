-- Complete the notification catalog with high-value organization events.

insert into public.notification_rules (
  org_id, type, label, category, description, target_roles, enabled,
  required, in_app_enabled, push_enabled, priority, reminder_offsets
)
select
  organization.id,
  'event_created',
  'New event',
  'events',
  'Members are told when a new event is added to the calendar.',
  array['Members'],
  true, false, true, false, 'normal', '{}'::integer[]
from public.organizations organization
on conflict (org_id, type) do nothing;

create or replace function private.notify_event_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify_all_except(
    new.created_by,
    'event_created',
    'New Event',
    new.title || ' was added for ' || to_char(new.event_date, 'FMMonth FMDD, YYYY') || '.',
    jsonb_build_object(
      'event_id', new.id::text,
      'event_title', new.title,
      'event_date', to_char(new.event_date, 'FMMonth FMDD, YYYY'),
      'url', '/events/' || new.id::text,
      'dedupe_key', 'event-created:' || new.id::text
    )
  );
  return new;
end;
$$;

drop trigger if exists events_create_created_notifications on public.events;
create trigger events_create_created_notifications
after insert on public.events
for each row execute function private.notify_event_created();

create or replace function private.notify_member_joined()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_leader_id uuid;
  v_name text;
begin
  if new.org_id is null
    or (tg_op = 'UPDATE' and old.org_id is not distinct from new.org_id) then
    return new;
  end if;

  v_name := nullif(btrim(concat_ws(' ', new.first_name, new.last_name)), '');
  for v_leader_id in
    select distinct leader.id
    from public.profiles leader
    join public.user_roles membership on membership.user_id = leader.id
    join public.roles role on role.id = membership.role_id
    where leader.org_id = new.org_id
      and leader.id <> new.id
      and role.is_leadership = true
  loop
    perform public.create_notification(
      v_leader_id,
      'member_joined',
      'New Team Member',
      coalesce(v_name, 'A new member') || ' joined your ServeSync organization.',
      jsonb_build_object(
        'member_id', new.id::text,
        'member_name', coalesce(v_name, 'New member'),
        'url', '/team',
        'dedupe_key', 'member-joined:' || new.id::text || ':' || new.org_id::text
      )
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists profiles_create_member_joined_notifications on public.profiles;
create trigger profiles_create_member_joined_notifications
after insert or update of org_id on public.profiles
for each row execute function private.notify_member_joined();

create or replace function private.notify_discipline_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text := case when tg_op = 'INSERT' then 'discipline_created' else 'discipline_updated' end;
  v_title text := case when tg_op = 'INSERT' then 'Conduct Record Created' else 'Conduct Record Updated' end;
begin
  if tg_op = 'UPDATE' and row(old.status, old.title, old.notes, old.final_decision, old.resolved_at)
    is not distinct from row(new.status, new.title, new.notes, new.final_decision, new.resolved_at) then
    return new;
  end if;

  perform public.create_notification(
    new.user_id,
    v_type,
    v_title,
    new.title || case
      when new.status = 'resolved' then ' has been resolved.'
      else ' now has status: ' || initcap(replace(new.status, '_', ' ')) || '.'
    end,
    jsonb_build_object(
      'discipline_id', new.id::text,
      'status', new.status,
      'url', '/profile',
      'dedupe_key', v_type || ':' || new.id::text || ':' || txid_current()::text
    )
  );
  return new;
end;
$$;

drop trigger if exists discipline_records_create_notifications on public.discipline_records;
create trigger discipline_records_create_notifications
after insert on public.discipline_records
for each row execute function private.notify_discipline_change();

drop trigger if exists discipline_records_update_notifications on public.discipline_records;
create trigger discipline_records_update_notifications
after update of status, title, notes, final_decision, resolved_at on public.discipline_records
for each row execute function private.notify_discipline_change();

create or replace function private.create_birthday_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_created integer := 0;
begin
  with birthday_people as (
    select
      profile.id,
      profile.org_id,
      coalesce(nullif(btrim(profile.first_name), ''), 'A teammate') as first_name,
      settings.default_timezone
    from public.profiles profile
    join public.notification_system_settings settings on settings.org_id = profile.org_id
    where profile.birthday is not null
      and to_char(now() at time zone settings.default_timezone, 'HH24') = '08'
      and to_char(profile.birthday, 'MM-DD') = to_char((now() at time zone settings.default_timezone)::date, 'MM-DD')
  ), inserted as (
    insert into public.notifications (user_id, org_id, type, title, body, data)
    select
      recipient.id,
      birthday_person.org_id,
      'birthday',
      'Birthday Today',
      'Today is ' || birthday_person.first_name || '''s birthday!',
      jsonb_build_object(
        'member_id', birthday_person.id::text,
        'member_name', birthday_person.first_name,
        'url', '/events',
        'dedupe_key', 'birthday:' || birthday_person.id::text || ':' || to_char((now() at time zone birthday_person.default_timezone)::date, 'YYYY-MM-DD')
      )
    from birthday_people birthday_person
    join public.profiles recipient
      on recipient.org_id = birthday_person.org_id
     and recipient.id <> birthday_person.id
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing
    returning 1
  )
  select count(*) into v_created from inserted;
  return v_created;
end;
$$;

do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'servesync-birthday-notifications';

  perform cron.schedule(
    'servesync-birthday-notifications',
    '0 * * * *',
    'select private.create_birthday_notifications();'
  );
end;
$$;

-- Keep event_created available when a new organization is created on the live
-- database where the original catalog function predates this rule.
create or replace function private.ensure_event_created_rule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notification_rules (
    org_id, type, label, category, description, target_roles, enabled,
    required, in_app_enabled, push_enabled, priority, reminder_offsets
  ) values (
    new.id, 'event_created', 'New event', 'events',
    'Members are told when a new event is added to the calendar.',
    array['Members'], true, false, true, false, 'normal', '{}'::integer[]
  ) on conflict (org_id, type) do nothing;
  return new;
end;
$$;

drop trigger if exists organizations_ensure_event_created_rule on public.organizations;
create trigger organizations_ensure_event_created_rule
after insert on public.organizations
for each row execute function private.ensure_event_created_rule();

revoke all on function private.notify_event_created() from public, anon, authenticated;
revoke all on function private.notify_member_joined() from public, anon, authenticated;
revoke all on function private.notify_discipline_change() from public, anon, authenticated;
revoke all on function private.create_birthday_notifications() from public, anon, authenticated;
revoke all on function private.ensure_event_created_rule() from public, anon, authenticated;

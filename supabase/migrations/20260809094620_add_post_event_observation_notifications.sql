-- Prompt every organization member to add observations after an event ends.
-- Events remain in Upcoming until an admin moves them to Past; this job only
-- creates the post-event notification.

insert into public.notification_rules (
  org_id, type, label, category, description, target_roles, enabled,
  required, in_app_enabled, push_enabled, priority, reminder_offsets
)
select
  organization.id,
  'post_event_observation_reminder',
  'Post-event observations',
  'events',
  'Members are invited to record observations after an event finishes.',
  array['Members'],
  true, false, true, true, 'normal', '{}'::integer[]
from public.organizations organization
on conflict (org_id, type) do nothing;

create or replace function private.ensure_post_event_observation_rule()
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
    new.id,
    'post_event_observation_reminder',
    'Post-event observations',
    'events',
    'Members are invited to record observations after an event finishes.',
    array['Members'],
    true, false, true, true, 'normal', '{}'::integer[]
  ) on conflict (org_id, type) do nothing;

  return new;
end;
$$;

drop trigger if exists organizations_ensure_post_event_observation_rule
  on public.organizations;
create trigger organizations_ensure_post_event_observation_rule
after insert on public.organizations
for each row execute function private.ensure_post_event_observation_rule();

create or replace function private.create_post_event_observation_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_created integer := 0;
begin
  with finished_events as (
    select event.id, event.org_id, event.title
    from public.events event
    left join public.notification_system_settings settings
      on settings.org_id = event.org_id
    where event.event_date >= date '2026-08-09'
      and (
        event.event_date + coalesce(event.end_time, event.start_time)
      ) at time zone coalesce(settings.default_timezone, 'Asia/Manila') <= now()
  ), inserted as (
    insert into public.notifications (user_id, org_id, type, title, body, data)
    select
      recipient.id,
      finished_event.org_id,
      'post_event_observation_reminder',
      'Event finished - add observations',
      finished_event.title || ' has finished. Share what worked or what the team should improve, fix, or monitor.',
      jsonb_build_object(
        'event_id', finished_event.id::text,
        'event_title', finished_event.title,
        'url', '/events/' || finished_event.id::text,
        'dedupe_key', 'post-event-observations:' || finished_event.id::text
      )
    from finished_events finished_event
    join public.profiles recipient
      on recipient.org_id = finished_event.org_id
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
  where jobname = 'servesync-post-event-observation-notifications';

  perform cron.schedule(
    'servesync-post-event-observation-notifications',
    '* * * * *',
    'select private.create_post_event_observation_notifications();'
  );
end;
$$;

revoke all on function private.ensure_post_event_observation_rule()
  from public, anon, authenticated;
revoke all on function private.create_post_event_observation_notifications()
  from public, anon, authenticated;

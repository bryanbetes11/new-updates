-- Turn the existing post-event observation reminder into an attendance-aware
-- check-out prompt, and use the clearer member-facing On-time label for QR
-- attendance confirmations. Stored attendance values remain unchanged.

update public.notification_rules
set
  label = 'Post-event check-out',
  description = 'Members with a verified On-time or Late attendance record are invited to add a post-event observation.',
  target_roles = array['Attendees']::text[],
  updated_at = now()
where type = 'post_event_observation_reminder';

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
    'Post-event check-out',
    'events',
    'Members with a verified On-time or Late attendance record are invited to add a post-event observation.',
    array['Attendees'],
    true, false, true, true, 'normal', '{}'::integer[]
  ) on conflict (org_id, type) do nothing;

  return new;
end;
$$;

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
      'Thanks for serving - anything to share?',
      finished_event.title || ' has finished. Add an observation about what worked or what the team should improve, fix, or monitor.',
      jsonb_build_object(
        'event_id', finished_event.id::text,
        'event_title', finished_event.title,
        'url', '/events/' || finished_event.id::text || '?addObservation=1',
        'dedupe_key', 'post-event-observations:' || finished_event.id::text
      )
    from finished_events finished_event
    join public.event_attendance attendance
      on attendance.event_id = finished_event.id
      and attendance.org_id = finished_event.org_id
      and attendance.status in ('present', 'late')
      and attendance.review_status = 'verified'
    join public.profiles recipient
      on recipient.id = attendance.user_id
      and recipient.org_id = finished_event.org_id
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing
    returning 1
  )
  select count(*) into v_created from inserted;

  return v_created;
end;
$$;

create or replace function private.notify_qr_attendance_recorded()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_title text;
  v_status_label text;
  v_time_label text;
begin
  if new.record_source <> 'member'
    or new.review_status <> 'verified'
    or new.status not in ('present', 'late')
    or coalesce(new.notes, '') not ilike 'Checked in with church QR%' then
    return new;
  end if;

  select event.title
  into v_event_title
  from public.events event
  where event.id = new.event_id
    and event.org_id = new.org_id;

  v_status_label := case when new.status = 'present' then 'On-time' else 'Late' end;
  v_time_label := to_char(
    timezone('Asia/Manila', coalesce(new.checked_in_at, new.created_at)),
    'FMHH12:MI AM'
  );

  perform public.create_notification(
    new.user_id,
    'attendance_qr_recorded',
    'Attendance recorded: ' || v_status_label,
    'Your attendance for ' || coalesce(v_event_title, 'the event') ||
      ' was recorded as ' || v_status_label || ' at ' || v_time_label || '.',
    jsonb_build_object(
      'event_id', new.event_id::text,
      'attendance_id', new.id::text,
      'status', new.status,
      'url', '/events/' || new.event_id::text,
      'dedupe_key', 'attendance-qr-recorded:' || new.id::text
    )
  );

  return new;
end;
$$;

revoke all on function private.ensure_post_event_observation_rule()
  from public, anon, authenticated;
revoke all on function private.create_post_event_observation_notifications()
  from public, anon, authenticated;
revoke all on function private.notify_qr_attendance_recorded()
  from public, anon, authenticated;

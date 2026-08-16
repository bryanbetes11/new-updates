-- QR attendance notification lifecycle: keep the existing attendance reminder
-- pipeline while making each message match the QR-only, explicit Check In flow.

insert into public.notification_rules (
  org_id, type, label, category, description, target_roles, enabled,
  required, in_app_enabled, push_enabled, priority, reminder_offsets
)
select
  organization.id,
  rule.type,
  rule.label,
  'attendance',
  rule.description,
  array['Assigned members']::text[],
  true,
  true,
  true,
  true,
  rule.priority,
  '{}'::integer[]
from public.organizations organization
cross join (
  values
    (
      'attendance_scan_incomplete'::text,
      'Incomplete QR check-in'::text,
      'A member scanned the church QR but did not tap Check In before the short-lived session expired.'::text,
      'high'::text
    ),
    (
      'attendance_qr_recorded'::text,
      'QR attendance recorded'::text,
      'A member receives confirmation that a QR check-in was recorded as Present or Late.'::text,
      'normal'::text
    )
) as rule(type, label, description, priority)
on conflict (org_id, type) do update
set
  label = excluded.label,
  category = excluded.category,
  description = excluded.description,
  target_roles = excluded.target_roles,
  required = excluded.required,
  in_app_enabled = excluded.in_app_enabled,
  push_enabled = excluded.push_enabled,
  priority = excluded.priority,
  updated_at = now();

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

  v_status_label := initcap(new.status);
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

revoke all on function private.notify_qr_attendance_recorded()
  from public, anon, authenticated;

drop trigger if exists event_attendance_create_qr_recorded_notification
  on public.event_attendance;
create trigger event_attendance_create_qr_recorded_notification
after insert on public.event_attendance
for each row execute function private.notify_qr_attendance_recorded();

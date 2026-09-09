-- A QR session is not proof of missing attendance: refreshes and repeat scans
-- create unused sessions even after a successful check-in. Check authoritative
-- assignments/attendance before an inbox row (and its push webhook) is created.
create or replace function private.guard_incomplete_attendance_reminder()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type <> 'attendance_scan_incomplete' then return new; end if;
  if not exists (
    select 1
    from public.attendance_qr_scan_sessions s
    join public.events e on e.org_id = s.org_id
    join public.event_assignments a
      on a.event_id = e.id and a.org_id = s.org_id and a.user_id = s.user_id
    left join public.organization_policy_settings p on p.org_id = s.org_id
    where s.id::text = new.data->>'session_id'
      and s.user_id = new.user_id and s.org_id = new.org_id
      and s.consumed_at is null and s.expires_at > now()
      and a.status <> 'declined'
      and e.event_date = timezone('Asia/Manila', now())::date
      and now() >= ((e.event_date + e.start_time) at time zone 'Asia/Manila')
        - make_interval(mins => coalesce(p.attendance_open_minutes_before, 30))
      and not exists (
        select 1 from public.event_attendance attendance
        where attendance.event_id = e.id and attendance.user_id = s.user_id
          and attendance.org_id = s.org_id
      )
  ) then return null; end if;
  return new;
end;
$$;
revoke all on function private.guard_incomplete_attendance_reminder() from public, anon, authenticated;

-- Run after org autofill; returning null prevents both inbox and push creation.
create trigger zz_guard_incomplete_attendance_reminder
before insert on public.notifications
for each row execute function private.guard_incomplete_attendance_reminder();

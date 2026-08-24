-- Editable, tenant-scoped operating policy. These values drive the public
-- attendance QR flow and its scheduled notifications; they are deliberately
-- separate from infrastructure secrets and database access controls.

create table if not exists public.organization_policy_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  attendance_open_minutes_before integer not null default 30 check (attendance_open_minutes_before between 0 and 180),
  attendance_grace_minutes integer not null default 5 check (attendance_grace_minutes between 0 and 60),
  attendance_scan_session_minutes integer not null default 5 check (attendance_scan_session_minutes between 1 and 30),
  attendance_incomplete_scan_minutes integer not null default 2 check (attendance_incomplete_scan_minutes between 1 and 30),
  default_setlist_due_days_before integer not null default 21 check (default_setlist_due_days_before between 1 and 90),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.organization_policy_settings (org_id)
select id from public.organizations
on conflict (org_id) do nothing;

alter table public.organization_policy_settings enable row level security;

drop policy if exists "Members can view same-org policy settings" on public.organization_policy_settings;
create policy "Members can view same-org policy settings"
  on public.organization_policy_settings for select to authenticated
  using (org_id = (select public.auth_org_id()));

drop policy if exists "Church admins update policy settings" on public.organization_policy_settings;
create policy "Church admins update policy settings"
  on public.organization_policy_settings for update to authenticated
  using (
    org_id = (select public.auth_org_id())
    and ((select public.auth_is_org_admin()) or (select public.is_platform_owner()))
  )
  with check (
    org_id = (select public.auth_org_id())
    and ((select public.auth_is_org_admin()) or (select public.is_platform_owner()))
  );

grant select, update on public.organization_policy_settings to authenticated;
grant all on public.organization_policy_settings to service_role;

create or replace function public.get_qr_attendance_admin_state()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
  v_token uuid;
  v_policy public.organization_policy_settings%rowtype;
begin
  if not (public.auth_is_org_admin() or public.auth_is_org_leader()) then
    raise exception 'Not authorized to manage the attendance QR';
  end if;
  v_org_id := public.auth_org_id();
  if v_org_id is null then raise exception 'No organization selected'; end if;
  insert into public.organization_policy_settings(org_id) values (v_org_id)
    on conflict (org_id) do nothing;
  select * into v_policy from public.organization_policy_settings where org_id = v_org_id;
  insert into public.attendance_qr_checkpoints(org_id, created_by)
  values (v_org_id, auth.uid())
  on conflict (org_id) do update set active = true, updated_at = now()
  returning token into v_token;
  return jsonb_build_object(
    'checkpoint_token', v_token, 'active', true,
    'session_minutes', v_policy.attendance_scan_session_minutes,
    'window_opens_minutes_before', v_policy.attendance_open_minutes_before,
    'present_grace_minutes', v_policy.attendance_grace_minutes
  );
end;
$$;

create or replace function public.validate_qr_attendance_checkpoint(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
  v_session_id uuid;
  v_expires_at timestamptz;
  v_today date := timezone('Asia/Manila', now())::date;
  v_policy public.organization_policy_settings%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in to scan attendance'; end if;
  v_org_id := public.auth_org_id();
  if v_org_id is null then raise exception 'No organization selected'; end if;
  if not exists (select 1 from public.attendance_qr_checkpoints checkpoint where checkpoint.org_id = v_org_id and checkpoint.token = p_token and checkpoint.active) then
    raise exception 'This attendance QR is not active for your church';
  end if;
  insert into public.organization_policy_settings(org_id) values (v_org_id) on conflict (org_id) do nothing;
  select * into v_policy from public.organization_policy_settings where org_id = v_org_id;
  delete from public.attendance_qr_scan_sessions where user_id = auth.uid() and expires_at < now() - interval '1 day';
  v_expires_at := now() + make_interval(mins => v_policy.attendance_scan_session_minutes);
  insert into public.attendance_qr_scan_sessions(org_id, user_id, checkpoint_org_id, expires_at)
  values (v_org_id, auth.uid(), v_org_id, v_expires_at) returning id into v_session_id;
  return jsonb_build_object(
    'session_token', v_session_id, 'expires_at', v_expires_at,
    'events', coalesce((
      select jsonb_agg(event_row order by event_row.starts_at, event_row.title)
      from (
        select scheduled.* from (
          select distinct on (event.id)
            event.id, event.title,
            ((event.event_date + event.start_time) at time zone 'Asia/Manila') as starts_at,
            case when event.end_time is not null then ((event.event_date + event.end_time) at time zone 'Asia/Manila') else ((event.event_date + event.start_time) at time zone 'Asia/Manila') + interval '6 hours' end as ends_at,
            ((event.event_date + event.start_time) at time zone 'Asia/Manila') - make_interval(mins => v_policy.attendance_open_minutes_before) as opens_at,
            (event.event_date = v_today and now() >= ((event.event_date + event.start_time) at time zone 'Asia/Manila') - make_interval(mins => v_policy.attendance_open_minutes_before)) as attendance_open,
            attendance.status as existing_status, attendance.checked_in_at
          from public.events event
          join public.event_assignments assignment on assignment.event_id = event.id and assignment.org_id = v_org_id and assignment.user_id = auth.uid() and assignment.status <> 'declined'
          left join public.event_attendance attendance on attendance.event_id = event.id and attendance.user_id = auth.uid() and attendance.org_id = v_org_id
          where event.org_id = v_org_id and event.event_date >= v_today
          order by event.id, assignment.created_at, assignment.id
        ) scheduled order by scheduled.starts_at, scheduled.title limit 5
      ) event_row
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.record_qr_attendance_checkin(p_session_token uuid, p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
  v_event public.events%rowtype;
  v_status text;
  v_checked_in_at timestamptz;
  v_existing public.event_attendance%rowtype;
  v_policy public.organization_policy_settings%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in to check in'; end if;
  v_org_id := public.auth_org_id();
  if v_org_id is null then raise exception 'No organization selected'; end if;
  perform 1 from public.attendance_qr_scan_sessions session where session.id = p_session_token and session.org_id = v_org_id and session.user_id = auth.uid() and session.checkpoint_org_id = v_org_id and session.consumed_at is null and session.expires_at > now() for update;
  if not found then raise exception 'This scan session expired or was already used. Scan the church QR again.'; end if;
  insert into public.organization_policy_settings(org_id) values (v_org_id) on conflict (org_id) do nothing;
  select * into v_policy from public.organization_policy_settings where org_id = v_org_id;
  select event.* into v_event from public.events event
  where event.id = p_event_id and event.org_id = v_org_id and event.event_date = timezone('Asia/Manila', now())::date
    and now() >= ((event.event_date + event.start_time) at time zone 'Asia/Manila') - make_interval(mins => v_policy.attendance_open_minutes_before);
  if not found then raise exception 'Attendance is not open for this event'; end if;
  if not exists (select 1 from public.event_assignments assignment where assignment.org_id = v_org_id and assignment.event_id = p_event_id and assignment.user_id = auth.uid() and assignment.status <> 'declined') then raise exception 'You are not scheduled for this event'; end if;
  select attendance.* into v_existing from public.event_attendance attendance where attendance.event_id = p_event_id and attendance.user_id = auth.uid() and attendance.org_id = v_org_id;
  if found then
    if v_existing.status not in ('present', 'late') then raise exception 'This attendance already has a % status. Ask a leader if it needs correction.', v_existing.status; end if;
    v_status := v_existing.status; v_checked_in_at := v_existing.checked_in_at;
  else
    v_checked_in_at := now();
    v_status := case when v_checked_in_at > ((v_event.event_date + v_event.start_time) at time zone 'Asia/Manila') + make_interval(mins => v_policy.attendance_grace_minutes) then 'late' else 'present' end;
    insert into public.event_attendance(event_id, user_id, org_id, status, checked_in_at, is_assigned, notes, record_source, review_status, marked_by, marked_at)
    values (p_event_id, auth.uid(), v_org_id, v_status, v_checked_in_at, true, 'Checked in with church QR', 'member', 'verified', auth.uid(), v_checked_in_at)
    on conflict (event_id, user_id) do nothing;
    select attendance.* into v_existing from public.event_attendance attendance where attendance.event_id = p_event_id and attendance.user_id = auth.uid() and attendance.org_id = v_org_id;
    v_status := v_existing.status; v_checked_in_at := v_existing.checked_in_at;
  end if;
  update public.attendance_qr_scan_sessions set consumed_at = now() where id = p_session_token;
  return jsonb_build_object('event_id', v_event.id, 'event_title', v_event.title, 'status', v_status, 'checked_in_at', v_checked_in_at, 'pilot_only', false);
end;
$$;

revoke all on function public.get_qr_attendance_admin_state() from public, anon;
revoke all on function public.validate_qr_attendance_checkpoint(uuid) from public, anon;
revoke all on function public.record_qr_attendance_checkin(uuid, uuid) from public, anon;
grant execute on function public.get_qr_attendance_admin_state() to authenticated;
grant execute on function public.validate_qr_attendance_checkpoint(uuid) to authenticated;
grant execute on function public.record_qr_attendance_checkin(uuid, uuid) to authenticated;

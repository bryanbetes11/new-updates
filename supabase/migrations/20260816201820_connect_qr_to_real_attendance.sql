-- Connect the reusable church QR to the canonical event attendance records.
-- The printed checkpoint token opens a short-lived, member-bound, one-use
-- session. Only scheduled members and same-day open attendance windows are
-- returned. Direct member writes are removed so the QR RPC is the only member
-- check-in path; leaders retain their existing correction workflow.

create table if not exists public.attendance_qr_checkpoints (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance_qr_scan_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  checkpoint_org_id uuid not null references public.attendance_qr_checkpoints(org_id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint attendance_qr_scan_sessions_valid_expiry check (expires_at > created_at)
);

create index if not exists attendance_qr_checkpoints_created_by_idx
  on public.attendance_qr_checkpoints(created_by);
create index if not exists attendance_qr_scan_sessions_user_expiry_idx
  on public.attendance_qr_scan_sessions(user_id, expires_at desc);
create index if not exists attendance_qr_scan_sessions_checkpoint_idx
  on public.attendance_qr_scan_sessions(checkpoint_org_id);

alter table public.attendance_qr_checkpoints enable row level security;
alter table public.attendance_qr_scan_sessions enable row level security;

revoke all on table public.attendance_qr_checkpoints from public, anon, authenticated;
revoke all on table public.attendance_qr_scan_sessions from public, anon, authenticated;

create or replace function public.get_qr_attendance_admin_state()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
  v_token uuid;
begin
  if not (public.auth_is_org_admin() or public.auth_is_org_leader()) then
    raise exception 'Not authorized to manage the attendance QR';
  end if;

  v_org_id := public.auth_org_id();
  if v_org_id is null then raise exception 'No organization selected'; end if;

  insert into public.attendance_qr_checkpoints(org_id, created_by)
  values (v_org_id, auth.uid())
  on conflict (org_id) do update
    set active = true,
        updated_at = now()
  returning token into v_token;

  return jsonb_build_object(
    'checkpoint_token', v_token,
    'active', true,
    'session_minutes', 5,
    'window_opens_minutes_before', 30,
    'present_grace_minutes', 5
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
begin
  if auth.uid() is null then raise exception 'Sign in to scan attendance'; end if;
  v_org_id := public.auth_org_id();
  if v_org_id is null then raise exception 'No organization selected'; end if;

  if not exists (
    select 1
    from public.attendance_qr_checkpoints checkpoint
    where checkpoint.org_id = v_org_id
      and checkpoint.token = p_token
      and checkpoint.active
  ) then
    raise exception 'This attendance QR is not active for your church';
  end if;

  -- Keep the private session table bounded without exposing a cleanup job.
  delete from public.attendance_qr_scan_sessions
  where user_id = auth.uid()
    and expires_at < now() - interval '1 day';

  v_expires_at := now() + interval '5 minutes';
  insert into public.attendance_qr_scan_sessions(
    org_id, user_id, checkpoint_org_id, expires_at
  ) values (
    v_org_id, auth.uid(), v_org_id, v_expires_at
  ) returning id into v_session_id;

  return jsonb_build_object(
    'session_token', v_session_id,
    'expires_at', v_expires_at,
    'events', coalesce((
      select jsonb_agg(event_row order by event_row.starts_at, event_row.title)
      from (
        select distinct on (event.id)
          event.id,
          event.title,
          ((event.event_date + event.start_time) at time zone 'Asia/Manila') as starts_at,
          case
            when event.end_time is not null
              then ((event.event_date + event.end_time) at time zone 'Asia/Manila')
            else ((event.event_date + event.start_time) at time zone 'Asia/Manila') + interval '6 hours'
          end as ends_at,
          attendance.status as existing_status,
          attendance.checked_in_at
        from public.events event
        join public.event_assignments assignment
          on assignment.event_id = event.id
         and assignment.org_id = v_org_id
         and assignment.user_id = auth.uid()
         and assignment.status <> 'declined'
        left join public.event_attendance attendance
          on attendance.event_id = event.id
         and attendance.user_id = auth.uid()
         and attendance.org_id = v_org_id
        where event.org_id = v_org_id
          and event.event_date = v_today
          and now() >= ((event.event_date + event.start_time) at time zone 'Asia/Manila') - interval '30 minutes'
        order by event.id, assignment.created_at, assignment.id
      ) event_row
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.record_qr_attendance_checkin(
  p_session_token uuid,
  p_event_id uuid
)
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
begin
  if auth.uid() is null then raise exception 'Sign in to check in'; end if;
  v_org_id := public.auth_org_id();
  if v_org_id is null then raise exception 'No organization selected'; end if;

  perform 1
  from public.attendance_qr_scan_sessions session
  where session.id = p_session_token
    and session.org_id = v_org_id
    and session.user_id = auth.uid()
    and session.checkpoint_org_id = v_org_id
    and session.consumed_at is null
    and session.expires_at > now()
  for update;
  if not found then
    raise exception 'This scan session expired or was already used. Scan the church QR again.';
  end if;

  select event.* into v_event
  from public.events event
  where event.id = p_event_id
    and event.org_id = v_org_id
    and event.event_date = timezone('Asia/Manila', now())::date
    and now() >= ((event.event_date + event.start_time) at time zone 'Asia/Manila') - interval '30 minutes';
  if not found then raise exception 'Attendance is not open for this event'; end if;

  if not exists (
    select 1 from public.event_assignments assignment
    where assignment.org_id = v_org_id
      and assignment.event_id = p_event_id
      and assignment.user_id = auth.uid()
      and assignment.status <> 'declined'
  ) then
    raise exception 'You are not scheduled for this event';
  end if;

  select attendance.* into v_existing
  from public.event_attendance attendance
  where attendance.event_id = p_event_id
    and attendance.user_id = auth.uid()
    and attendance.org_id = v_org_id;

  if found then
    if v_existing.status not in ('present', 'late') then
      raise exception 'This attendance already has a % status. Ask a leader if it needs correction.', v_existing.status;
    end if;
    v_status := v_existing.status;
    v_checked_in_at := v_existing.checked_in_at;
  else
    v_checked_in_at := now();
    v_status := case
      when v_checked_in_at > ((v_event.event_date + v_event.start_time) at time zone 'Asia/Manila') + interval '5 minutes'
        then 'late'
      else 'present'
    end;

    insert into public.event_attendance(
      event_id, user_id, org_id, status, checked_in_at, is_assigned,
      notes, record_source, review_status, marked_by, marked_at
    ) values (
      p_event_id, auth.uid(), v_org_id, v_status, v_checked_in_at, true,
      'Checked in with church QR', 'member', 'verified', auth.uid(), v_checked_in_at
    )
    on conflict (event_id, user_id) do nothing;

    select attendance.* into v_existing
    from public.event_attendance attendance
    where attendance.event_id = p_event_id
      and attendance.user_id = auth.uid()
      and attendance.org_id = v_org_id;
    v_status := v_existing.status;
    v_checked_in_at := v_existing.checked_in_at;
  end if;

  update public.attendance_qr_scan_sessions
  set consumed_at = now()
  where id = p_session_token;

  return jsonb_build_object(
    'event_id', v_event.id,
    'event_title', v_event.title,
    'status', v_status,
    'checked_in_at', v_checked_in_at,
    'pilot_only', false
  );
end;
$$;

-- Members may still read their record, while all member-created writes must
-- pass through the session-bound RPC. Existing leader policies remain intact.
drop policy if exists "Users can insert own same-org attendance" on public.event_attendance;
drop policy if exists "Users can update own same-org attendance" on public.event_attendance;
drop policy if exists "Users can insert own attendance" on public.event_attendance;
drop policy if exists "Users can update own attendance" on public.event_attendance;

-- A decline with a required reason becomes an Excused outcome once every role
-- assignment for that member/event is declined. Re-confirming any role removes
-- only the system-created excuse and never overwrites a member or leader mark.
create or replace function public.sync_declined_assignment_excuse()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_id uuid;
  v_user_id uuid;
  v_org_id uuid;
  v_reason text;
begin
  if TG_OP = 'DELETE' then
    v_event_id := old.event_id;
    v_user_id := old.user_id;
    v_org_id := old.org_id;
  else
    v_event_id := new.event_id;
    v_user_id := new.user_id;
    v_org_id := new.org_id;
  end if;

  if exists (
    select 1 from public.event_assignments assignment
    where assignment.event_id = v_event_id
      and assignment.user_id = v_user_id
      and assignment.org_id = v_org_id
  ) and not exists (
    select 1 from public.event_assignments assignment
    where assignment.event_id = v_event_id
      and assignment.user_id = v_user_id
      and assignment.org_id = v_org_id
      and assignment.status <> 'declined'
  ) then
    select string_agg(distinct btrim(assignment.decline_reason), '; ' order by btrim(assignment.decline_reason))
      into v_reason
    from public.event_assignments assignment
    where assignment.event_id = v_event_id
      and assignment.user_id = v_user_id
      and assignment.org_id = v_org_id
      and assignment.status = 'declined';

    if nullif(v_reason, '') is not null then
      insert into public.event_attendance(
        event_id, user_id, org_id, status, checked_in_at, is_assigned,
        notes, excused_reason, record_source, review_status, marked_by, marked_at
      ) values (
        v_event_id, v_user_id, v_org_id, 'excused', null, true,
        'Auto-excused from declined assignment', v_reason,
        'automatic', 'verified', v_user_id, now()
      )
      on conflict (event_id, user_id) do update
      set status = 'excused',
          checked_in_at = null,
          notes = 'Auto-excused from declined assignment',
          excused_reason = excluded.excused_reason,
          record_source = 'automatic',
          review_status = 'verified',
          reviewed_by = null,
          reviewed_at = null,
          updated_at = now()
      where public.event_attendance.record_source = 'automatic'
        and public.event_attendance.notes = 'Auto-excused from declined assignment';
    end if;
  else
    delete from public.event_attendance attendance
    where attendance.event_id = v_event_id
      and attendance.user_id = v_user_id
      and attendance.org_id = v_org_id
      and attendance.record_source = 'automatic'
      and attendance.notes = 'Auto-excused from declined assignment';
  end if;

  return null;
end;
$$;

drop trigger if exists event_assignments_sync_declined_excuse on public.event_assignments;
create trigger event_assignments_sync_declined_excuse
after insert or update of status, decline_reason or delete on public.event_assignments
for each row execute function public.sync_declined_assignment_excuse();

-- Backfill valid historical declines without overwriting real member/leader
-- attendance. One record is kept per member/event by the existing unique key.
with declined as (
  select assignment.org_id, assignment.event_id, assignment.user_id,
         string_agg(distinct btrim(assignment.decline_reason), '; ' order by btrim(assignment.decline_reason)) as reason
  from public.event_assignments assignment
  where assignment.status = 'declined'
  group by assignment.org_id, assignment.event_id, assignment.user_id
  having bool_and(nullif(btrim(assignment.decline_reason), '') is not null)
     and not exists (
       select 1 from public.event_assignments other
       where other.org_id = assignment.org_id
         and other.event_id = assignment.event_id
         and other.user_id = assignment.user_id
         and other.status <> 'declined'
     )
)
insert into public.event_attendance(
  event_id, user_id, org_id, status, checked_in_at, is_assigned,
  notes, excused_reason, record_source, review_status, marked_by, marked_at
)
select event_id, user_id, org_id, 'excused', null, true,
       'Auto-excused from declined assignment', reason,
       'automatic', 'verified', user_id, now()
from declined
on conflict (event_id, user_id) do nothing;

-- Include valid declines as scheduled + excused in quarterly summaries while
-- preserving the written offense rule: only verified absences and lates count.
create or replace function public.get_all_members_attendance_stats(
  p_year integer,
  p_quarter integer
)
returns table (
  user_id uuid, first_name text, last_name text, nickname text, avatar_url text,
  ministry_status text, events_assigned bigint, confirmed_count bigint,
  no_response_count bigint, present_count bigint, late_count bigint,
  absent_count bigint, excused_count bigint, needs_review_count bigint,
  dependability_incidents bigint, offense_level integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_start_date date;
  v_end_date date;
  v_finalized_through date;
  v_org_id uuid;
begin
  if not (public.auth_is_org_admin() or public.auth_is_org_leader()) then
    raise exception 'Not authorized to view team attendance stats';
  end if;
  v_org_id := public.auth_org_id();
  if v_org_id is null then raise exception 'No organization selected'; end if;
  v_start_date := public.get_quarter_start_date(p_year, p_quarter);
  v_end_date := public.get_quarter_end_date(p_year, p_quarter);
  v_finalized_through := least(v_end_date, timezone('Asia/Manila', now())::date - 2);

  return query
  with scheduled_events as (
    select distinct on (assignment.user_id, assignment.event_id)
      assignment.user_id, assignment.event_id, assignment.status as assignment_status
    from public.event_assignments assignment
    join public.events event on event.id = assignment.event_id and event.org_id = v_org_id
    where assignment.org_id = v_org_id
      and event.event_date between v_start_date and v_end_date
      and event.event_date <= v_finalized_through
    order by assignment.user_id, assignment.event_id,
      case assignment.status when 'confirmed' then 1 when 'pending' then 2 else 3 end,
      assignment.created_at, assignment.id
  ), member_counts as (
    select profile.id as member_id,
      count(scheduled.event_id) as events_assigned,
      count(*) filter (where scheduled.assignment_status = 'confirmed') as confirmed_count,
      count(*) filter (where scheduled.assignment_status = 'pending') as no_response_count,
      count(*) filter (where attendance.review_status = 'verified' and attendance.status = 'present') as present_count,
      count(*) filter (where attendance.review_status = 'verified' and attendance.status = 'late') as late_count,
      count(*) filter (where attendance.review_status = 'verified' and attendance.status = 'absent') as absent_count,
      count(*) filter (where attendance.review_status = 'verified' and attendance.status = 'excused') as excused_count,
      count(*) filter (where scheduled.event_id is not null and (attendance.id is null or attendance.review_status = 'needs_review')) as needs_review_count,
      count(*) filter (where attendance.review_status = 'verified' and attendance.status = 'absent') as dependability_incidents
    from public.profiles profile
    left join scheduled_events scheduled on scheduled.user_id = profile.id
    left join public.event_attendance attendance
      on attendance.org_id = v_org_id and attendance.event_id = scheduled.event_id and attendance.user_id = profile.id
    where profile.org_id = v_org_id and profile.is_onboarded = true
    group by profile.id
  )
  select profile.id, profile.first_name, profile.last_name, profile.nickname,
    profile.avatar_url, profile.ministry_status, counts.events_assigned,
    counts.confirmed_count, counts.no_response_count, counts.present_count,
    counts.late_count, counts.absent_count, counts.excused_count,
    counts.needs_review_count, counts.dependability_incidents,
    public.get_user_offense_level_v2(counts.late_count::integer, counts.dependability_incidents::integer)
  from public.profiles profile
  join member_counts counts on counts.member_id = profile.id
  left join public.organization_member_settings member_settings
    on member_settings.org_id = v_org_id and member_settings.user_id = profile.id
  where profile.org_id = v_org_id
    and profile.is_onboarded = true
    and coalesce(member_settings.include_in_attendance, true)
  order by offense_level desc, profile.first_name;
end;
$$;

create or replace function public.get_member_attendance_history(
  p_user_id uuid,
  p_limit integer default 20,
  p_year integer default null,
  p_quarter integer default null
)
returns table (
  attendance_id uuid, event_id uuid, event_title text, event_date date,
  event_type text, assignment_status text, status text, review_status text,
  record_source text, checked_in_at timestamptz, marked_at timestamptz,
  excused_reason text, notes text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
  v_finalized_through date;
  v_start_date date;
  v_end_date date;
begin
  v_org_id := public.auth_org_id();
  if v_org_id is null then raise exception 'No organization selected'; end if;
  if p_user_id <> auth.uid() and not (public.auth_is_org_admin() or public.auth_is_org_leader()) then
    raise exception 'Not authorized to view member attendance history';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and org_id = v_org_id) then
    raise exception 'Member not found in current organization';
  end if;
  if (p_year is null) <> (p_quarter is null) then raise exception 'Year and quarter must be provided together'; end if;
  if p_quarter is not null and p_quarter not between 1 and 4 then raise exception 'Quarter must be between 1 and 4'; end if;
  if p_year is not null then
    v_start_date := public.get_quarter_start_date(p_year, p_quarter);
    v_end_date := public.get_quarter_end_date(p_year, p_quarter);
  end if;
  v_finalized_through := timezone('Asia/Manila', now())::date - 2;

  return query
  with scheduled_events as (
    select distinct on (assignment.event_id)
      assignment.event_id, assignment.id as fallback_attendance_id,
      assignment.status as assignment_status
    from public.event_assignments assignment
    join public.events event on event.id = assignment.event_id and event.org_id = v_org_id
    where assignment.org_id = v_org_id
      and assignment.user_id = p_user_id
      and event.event_date <= v_finalized_through
      and (v_start_date is null or event.event_date between v_start_date and v_end_date)
    order by assignment.event_id,
      case assignment.status when 'confirmed' then 1 when 'pending' then 2 else 3 end,
      assignment.created_at, assignment.id
  )
  select coalesce(attendance.id, scheduled.fallback_attendance_id), event.id,
    event.title, event.event_date::date, event.event_type,
    scheduled.assignment_status,
    case when attendance.id is null or attendance.review_status = 'needs_review' then 'needs_review' else attendance.status end,
    coalesce(attendance.review_status, 'needs_review'),
    coalesce(attendance.record_source, 'automatic'), attendance.checked_in_at,
    attendance.marked_at, attendance.excused_reason, attendance.notes
  from scheduled_events scheduled
  join public.events event on event.id = scheduled.event_id and event.org_id = v_org_id
  left join public.event_attendance attendance
    on attendance.event_id = scheduled.event_id and attendance.user_id = p_user_id and attendance.org_id = v_org_id
  order by event.event_date desc, event.start_time desc
  limit greatest(p_limit, 0);
end;
$$;

revoke all on function public.get_qr_attendance_admin_state() from public, anon;
revoke all on function public.validate_qr_attendance_checkpoint(uuid) from public, anon;
revoke all on function public.record_qr_attendance_checkin(uuid, uuid) from public, anon;
revoke all on function public.sync_declined_assignment_excuse() from public, anon, authenticated;
revoke all on function public.get_all_members_attendance_stats(integer, integer) from public, anon;
revoke all on function public.get_member_attendance_history(uuid, integer, integer, integer) from public, anon;

grant execute on function public.get_qr_attendance_admin_state() to authenticated;
grant execute on function public.validate_qr_attendance_checkpoint(uuid) to authenticated;
grant execute on function public.record_qr_attendance_checkin(uuid, uuid) to authenticated;
grant execute on function public.get_all_members_attendance_stats(integer, integer) to authenticated;
grant execute on function public.get_member_attendance_history(uuid, integer, integer, integer) to authenticated;

comment on table public.attendance_qr_scan_sessions is
  'Private, short-lived, one-use sessions created after an authenticated member scans the reusable church QR.';

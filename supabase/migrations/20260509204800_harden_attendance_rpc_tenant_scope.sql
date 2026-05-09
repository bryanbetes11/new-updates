-- Harden legacy attendance RPCs so Leadership/Attendance screens cannot read
-- another church's member data through SECURITY DEFINER functions.

create or replace function public.get_all_members_attendance_stats(
  p_year integer,
  p_quarter integer
)
returns table (
  user_id uuid,
  first_name text,
  last_name text,
  nickname text,
  avatar_url text,
  ministry_status text,
  events_assigned bigint,
  present_count bigint,
  late_count bigint,
  absent_count bigint,
  excused_count bigint,
  offense_level integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_start_date date;
  v_end_date date;
  v_org_id uuid;
begin
  if not (public.auth_is_org_admin() or public.auth_is_org_leader()) then
    raise exception 'Not authorized to view team attendance stats';
  end if;

  v_org_id := public.auth_org_id();
  if v_org_id is null then
    raise exception 'No organization selected';
  end if;

  v_start_date := public.get_quarter_start_date(p_year, p_quarter);
  v_end_date := public.get_quarter_end_date(p_year, p_quarter);

  return query
  select
    p.id as user_id,
    p.first_name,
    p.last_name,
    p.nickname,
    p.avatar_url,
    p.ministry_status,
    count(e.id) as events_assigned,
    count(case when e.id is not null and ea.status = 'present' then 1 end) as present_count,
    count(case when e.id is not null and ea.status = 'late' then 1 end) as late_count,
    count(case when e.id is not null and ea.status = 'absent' then 1 end) as absent_count,
    count(case when e.id is not null and ea.status = 'excused' then 1 end) as excused_count,
    public.get_user_offense_level_v2(
      count(case when e.id is not null and ea.status = 'late' then 1 end)::integer,
      count(case when e.id is not null and ea.status = 'absent' then 1 end)::integer
    ) as offense_level
  from public.profiles p
  left join public.event_attendance ea
    on ea.user_id = p.id
   and ea.org_id = v_org_id
   and ea.is_assigned = true
  left join public.events e
    on e.id = ea.event_id
   and e.org_id = v_org_id
   and e.event_date between v_start_date and v_end_date
  where p.org_id = v_org_id
    and p.is_onboarded = true
  group by p.id, p.first_name, p.last_name, p.nickname, p.avatar_url, p.ministry_status
  order by offense_level desc, p.first_name;
end;
$$;

create or replace function public.get_member_attendance_history(
  p_user_id uuid,
  p_limit integer default 20
)
returns table (
  attendance_id uuid,
  event_id uuid,
  event_title text,
  event_date date,
  event_type text,
  status text,
  checked_in_at timestamptz,
  marked_at timestamptz,
  excused_reason text,
  notes text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
begin
  v_org_id := public.auth_org_id();
  if v_org_id is null then
    raise exception 'No organization selected';
  end if;

  if p_user_id <> auth.uid() and not (public.auth_is_org_admin() or public.auth_is_org_leader()) then
    raise exception 'Not authorized to view member attendance history';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.org_id = v_org_id
  ) then
    raise exception 'Member not found in current organization';
  end if;

  return query
  select
    ea.id as attendance_id,
    e.id as event_id,
    e.title as event_title,
    e.event_date::date,
    e.event_type,
    ea.status,
    ea.checked_in_at,
    ea.marked_at,
    ea.excused_reason,
    ea.notes
  from public.event_attendance ea
  join public.events e
    on e.id = ea.event_id
   and e.org_id = v_org_id
  where ea.user_id = p_user_id
    and ea.org_id = v_org_id
  order by e.event_date desc, e.start_time desc
  limit p_limit;
end;
$$;

create or replace function public.get_event_attendance_roster(p_event_id uuid)
returns table (
  user_id uuid,
  first_name text,
  last_name text,
  nickname text,
  avatar_url text,
  gender text,
  role_name text,
  attendance_id uuid,
  status text,
  checked_in_at timestamptz,
  marked_at timestamptz,
  excused_reason text,
  notes text,
  is_assigned boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
begin
  v_org_id := public.auth_org_id();
  if v_org_id is null then
    raise exception 'No organization selected';
  end if;

  if not (public.auth_is_org_admin() or public.auth_is_org_leader()) then
    raise exception 'Not authorized to view attendance roster';
  end if;

  if not exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and e.org_id = v_org_id
  ) then
    raise exception 'Event not found in current organization';
  end if;

  return query
  select
    p.id as user_id,
    p.first_name,
    p.last_name,
    p.nickname,
    p.avatar_url,
    p.gender,
    r.name as role_name,
    ea.id as attendance_id,
    ea.status,
    ea.checked_in_at,
    ea.marked_at,
    ea.excused_reason,
    ea.notes,
    true as is_assigned
  from public.event_assignments evta
  join public.profiles p
    on p.id = evta.user_id
   and p.org_id = v_org_id
  join public.roles r
    on r.id = evta.role_id
  left join public.event_attendance ea
    on ea.event_id = p_event_id
   and ea.user_id = p.id
   and ea.org_id = v_org_id
  where evta.event_id = p_event_id
    and evta.org_id = v_org_id
    and evta.status = 'confirmed'
  order by p.first_name, p.last_name;
end;
$$;

create or replace function public.get_org_member_accountability_rollup(
  p_org_id uuid,
  p_year integer,
  p_quarter integer
)
returns table (
  user_id uuid,
  proposal_overdue_count bigint,
  proposal_submitted_late_count bigint,
  pending_assignment_count bigint,
  approved_leave_count bigint,
  pending_leave_count bigint,
  open_discipline_count bigint,
  events_assigned bigint,
  present_count bigint,
  late_count bigint,
  absent_count bigint,
  excused_count bigint,
  offense_level integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_start_date date;
  v_end_date date;
  v_today date;
  v_now timestamptz;
begin
  if p_org_id is distinct from public.auth_org_id() and not public.is_platform_owner() then
    raise exception 'Not authorized to view another organization';
  end if;

  v_start_date := public.get_quarter_start_date(p_year, p_quarter);
  v_end_date := public.get_quarter_end_date(p_year, p_quarter);
  v_today := timezone('Asia/Manila', now())::date;
  v_now := now();

  return query
  select
    p.id as user_id,
    coalesce(proposals.proposal_overdue_count, 0) as proposal_overdue_count,
    coalesce(proposals.proposal_submitted_late_count, 0) as proposal_submitted_late_count,
    coalesce(assignments.pending_assignment_count, 0) as pending_assignment_count,
    coalesce(leaves.approved_leave_count, 0) as approved_leave_count,
    coalesce(leaves.pending_leave_count, 0) as pending_leave_count,
    coalesce(discipline.open_discipline_count, 0) as open_discipline_count,
    coalesce(attendance.events_assigned, 0) as events_assigned,
    coalesce(attendance.present_count, 0) as present_count,
    coalesce(attendance.late_count, 0) as late_count,
    coalesce(attendance.absent_count, 0) as absent_count,
    coalesce(attendance.excused_count, 0) as excused_count,
    public.get_user_offense_level_v2(
      coalesce(attendance.late_count, 0)::integer,
      coalesce(attendance.absent_count, 0)::integer
    ) as offense_level
  from public.profiles p
  left join lateral (
    select
      count(ea.id) as events_assigned,
      count(case when ea.status = 'present' then 1 end) as present_count,
      count(case when ea.status = 'late' then 1 end) as late_count,
      count(case when ea.status = 'absent' then 1 end) as absent_count,
      count(case when ea.status = 'excused' then 1 end) as excused_count
    from public.event_attendance ea
    join public.events e
      on e.id = ea.event_id
     and e.org_id = p_org_id
    where ea.user_id = p.id
      and ea.org_id = p_org_id
      and ea.is_assigned = true
      and e.event_date between v_start_date and v_end_date
  ) attendance on true
  left join lateral (
    select
      count(*) filter (
        where e.proposal_due_date is not null
          and e.proposal_due_date < v_now
          and setlist_state.first_submitted_at is null
          and coalesce(setlist_state.has_submitted_state, false) = false
      ) as proposal_overdue_count,
      count(*) filter (
        where setlist_state.first_submitted_at is not null
          and e.proposal_due_date is not null
          and setlist_state.first_submitted_at > e.proposal_due_date
      ) as proposal_submitted_late_count
    from public.events e
    join public.event_assignments event_assignment
      on event_assignment.event_id = e.id
     and event_assignment.user_id = p.id
     and event_assignment.org_id = p_org_id
    join public.roles r
      on r.id = event_assignment.role_id
     and r.name = 'Song Leader'
    left join lateral (
      select
        min(s.submitted_at) filter (where s.submitted_at is not null) as first_submitted_at,
        bool_or(s.status in ('pending_review', 'approved', 'revision_requested', 'rejected')) as has_submitted_state
      from public.setlists s
      where s.event_id = e.id
        and s.org_id = p_org_id
    ) setlist_state on true
    where e.org_id = p_org_id
      and e.event_date between v_start_date and v_end_date
  ) proposals on true
  left join lateral (
    select count(*) as pending_assignment_count
    from public.event_assignments ea
    join public.events e
      on e.id = ea.event_id
     and e.org_id = p_org_id
    where ea.user_id = p.id
      and ea.org_id = p_org_id
      and ea.status = 'pending'
      and e.event_date >= v_today
  ) assignments on true
  left join lateral (
    select
      count(*) filter (
        where ua.status = 'approved'
          and (
            (ua.leave_type = 'single' and ua.unavailable_date between v_start_date and v_end_date)
            or
            (ua.leave_type = 'range'
              and ua.start_date is not null
              and ua.end_date is not null
              and daterange(ua.start_date, ua.end_date, '[]') && daterange(v_start_date, v_end_date, '[]'))
          )
      ) as approved_leave_count,
      count(*) filter (
        where ua.status = 'pending'
          and (
            (ua.leave_type = 'single' and ua.unavailable_date between v_start_date and v_end_date)
            or
            (ua.leave_type = 'range'
              and ua.start_date is not null
              and ua.end_date is not null
              and daterange(ua.start_date, ua.end_date, '[]') && daterange(v_start_date, v_end_date, '[]'))
          )
      ) as pending_leave_count
    from public.user_availability ua
    where ua.user_id = p.id
      and ua.org_id = p_org_id
  ) leaves on true
  left join lateral (
    select count(*) as open_discipline_count
    from public.discipline_records dr
    where dr.user_id = p.id
      and dr.org_id = p_org_id
      and dr.status <> 'resolved'
  ) discipline on true
  where p.org_id = p_org_id
    and p.is_onboarded = true
  order by p.first_name, p.last_name;
end;
$$;

grant execute on function public.get_all_members_attendance_stats(integer, integer) to authenticated;
grant execute on function public.get_member_attendance_history(uuid, integer) to authenticated;
grant execute on function public.get_event_attendance_roster(uuid) to authenticated;
grant execute on function public.get_org_member_accountability_rollup(uuid, integer, integer) to authenticated;

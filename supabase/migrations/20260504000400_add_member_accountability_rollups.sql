-- ============================================================================
-- Member accountability rollups
-- ----------------------------------------------------------------------------
-- Purpose:
--   * expose a consistent quarterly accountability summary per member
--   * let leadership review the whole team from one RPC
--   * let members view their own status from Profile
-- ============================================================================

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
set search_path = public
as $$
declare
  v_start_date date;
  v_end_date date;
  v_today date;
  v_now timestamptz;
begin
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
    where ea.user_id = p.id
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
    join public.roles r
      on r.id = event_assignment.role_id
     and r.name = 'Song Leader'
    left join lateral (
      select
        min(s.submitted_at) filter (where s.submitted_at is not null) as first_submitted_at,
        bool_or(s.status in ('pending_review', 'approved', 'revision_requested', 'rejected')) as has_submitted_state
      from public.setlists s
      where s.event_id = e.id
    ) setlist_state on true
    where e.org_id = p_org_id
      and e.event_date between v_start_date and v_end_date
  ) proposals on true
  left join lateral (
    select count(*) as pending_assignment_count
    from public.event_assignments ea
    join public.events e
      on e.id = ea.event_id
    where ea.user_id = p.id
      and ea.status = 'pending'
      and e.event_date >= v_today
      and e.org_id = p_org_id
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
  ) leaves on true
  left join lateral (
    select count(*) as open_discipline_count
    from public.discipline_records dr
    where dr.user_id = p.id
      and dr.status <> 'resolved'
  ) discipline on true
  where p.org_id = p_org_id
    and p.is_onboarded = true
  order by p.first_name, p.last_name;
end;
$$;

create or replace function public.get_team_member_accountability_summaries(
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
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if not (public.auth_is_org_admin() or public.auth_is_org_leader()) then
    raise exception 'Not authorized to view team accountability summaries';
  end if;

  v_org_id := public.auth_org_id();

  return query
  select *
  from public.get_org_member_accountability_rollup(v_org_id, p_year, p_quarter);
end;
$$;

create or replace function public.get_my_accountability_summary(
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
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  v_org_id := public.auth_org_id();

  return query
  select *
  from public.get_org_member_accountability_rollup(v_org_id, p_year, p_quarter) as summary
  where summary.user_id = auth.uid();
end;
$$;

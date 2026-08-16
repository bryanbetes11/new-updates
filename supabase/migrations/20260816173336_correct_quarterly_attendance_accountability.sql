-- Make confirmed, distinct member-event assignments the source of truth for
-- quarterly attendance. Only events whose automatic-absence window has closed
-- are finalized. A missing mark on a finalized confirmed assignment counts as
-- absent, while pending/declined assignments and attendance-exempt members do
-- not affect accountability.

create or replace function private.get_finalized_member_attendance_stats(
  p_org_id uuid,
  p_user_id uuid,
  p_start_date date,
  p_end_date date,
  p_finalized_through date
)
returns table (
  events_assigned bigint,
  present_count bigint,
  late_count bigint,
  absent_count bigint,
  excused_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with confirmed_events as (
    select distinct assignment.event_id
    from public.event_assignments assignment
    join public.events event
      on event.id = assignment.event_id
     and event.org_id = p_org_id
    where assignment.org_id = p_org_id
      and assignment.user_id = p_user_id
      and assignment.status = 'confirmed'
      and event.event_date between p_start_date and p_end_date
      and event.event_date <= p_finalized_through
  )
  select
    count(confirmed.event_id) as events_assigned,
    count(*) filter (where attendance.status = 'present') as present_count,
    count(*) filter (where attendance.status = 'late') as late_count,
    count(*) filter (where coalesce(attendance.status, 'absent') = 'absent') as absent_count,
    count(*) filter (where attendance.status = 'excused') as excused_count
  from confirmed_events confirmed
  left join public.event_attendance attendance
    on attendance.org_id = p_org_id
   and attendance.event_id = confirmed.event_id
   and attendance.user_id = p_user_id;
$$;

revoke all on function private.get_finalized_member_attendance_stats(uuid, uuid, date, date, date)
  from public, anon, authenticated;

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
  v_finalized_through date;
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
  v_finalized_through := least(v_end_date, timezone('Asia/Manila', now())::date - 2);

  return query
  select
    profile.id,
    profile.first_name,
    profile.last_name,
    profile.nickname,
    profile.avatar_url,
    profile.ministry_status,
    attendance.events_assigned,
    attendance.present_count,
    attendance.late_count,
    attendance.absent_count,
    attendance.excused_count,
    public.get_user_offense_level_v2(
      attendance.late_count::integer,
      attendance.absent_count::integer
    )
  from public.profiles profile
  cross join lateral private.get_finalized_member_attendance_stats(
    v_org_id,
    profile.id,
    v_start_date,
    v_end_date,
    v_finalized_through
  ) attendance
  left join public.organization_member_settings member_settings
    on member_settings.org_id = v_org_id
   and member_settings.user_id = profile.id
  where profile.org_id = v_org_id
    and profile.is_onboarded = true
    and coalesce(member_settings.include_in_attendance, true)
  order by offense_level desc, profile.first_name;
end;
$$;

revoke all on function public.get_all_members_attendance_stats(integer, integer) from public, anon;
grant execute on function public.get_all_members_attendance_stats(integer, integer) to authenticated;

-- Keep the Profile accountability summary on the same finalized attendance
-- definition. Pending assignments remain a separate no-response signal.
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
  v_finalized_through date;
  v_today date;
  v_now timestamptz;
begin
  if p_org_id is distinct from public.auth_org_id() and not public.is_platform_owner() then
    raise exception 'Not authorized to view another organization';
  end if;

  v_start_date := public.get_quarter_start_date(p_year, p_quarter);
  v_end_date := public.get_quarter_end_date(p_year, p_quarter);
  v_today := timezone('Asia/Manila', now())::date;
  v_finalized_through := least(v_end_date, v_today - 2);
  v_now := now();

  return query
  select
    profile.id,
    coalesce(proposals.proposal_overdue_count, 0),
    coalesce(proposals.proposal_submitted_late_count, 0),
    coalesce(assignments.pending_assignment_count, 0),
    coalesce(leaves.approved_leave_count, 0),
    coalesce(leaves.pending_leave_count, 0),
    coalesce(discipline.open_discipline_count, 0),
    attendance.events_assigned,
    attendance.present_count,
    attendance.late_count,
    attendance.absent_count,
    attendance.excused_count,
    public.get_user_offense_level_v2(
      attendance.late_count::integer,
      attendance.absent_count::integer
    )
  from public.profiles profile
  cross join lateral private.get_finalized_member_attendance_stats(
    p_org_id,
    profile.id,
    v_start_date,
    v_end_date,
    v_finalized_through
  ) attendance
  left join lateral (
    select
      count(*) filter (
        where event.proposal_due_date is not null
          and event.proposal_due_date < v_now
          and setlist_state.first_submitted_at is null
          and coalesce(setlist_state.has_submitted_state, false) = false
      ) as proposal_overdue_count,
      count(*) filter (
        where setlist_state.first_submitted_at is not null
          and event.proposal_due_date is not null
          and setlist_state.first_submitted_at > event.proposal_due_date
      ) as proposal_submitted_late_count
    from public.events event
    join public.event_assignments event_assignment
      on event_assignment.event_id = event.id
     and event_assignment.user_id = profile.id
     and event_assignment.org_id = p_org_id
    join public.roles role
      on role.id = event_assignment.role_id
     and role.name = 'Song Leader'
    left join lateral (
      select
        min(setlist.submitted_at) filter (where setlist.submitted_at is not null) as first_submitted_at,
        bool_or(setlist.status in ('pending_review', 'approved', 'revision_requested', 'rejected')) as has_submitted_state
      from public.setlists setlist
      where setlist.event_id = event.id
        and setlist.org_id = p_org_id
    ) setlist_state on true
    where event.org_id = p_org_id
      and event.event_date between v_start_date and v_end_date
  ) proposals on true
  left join lateral (
    select count(distinct assignment.event_id) as pending_assignment_count
    from public.event_assignments assignment
    join public.events event
      on event.id = assignment.event_id
     and event.org_id = p_org_id
    where assignment.user_id = profile.id
      and assignment.org_id = p_org_id
      and assignment.status = 'pending'
      and event.event_date >= v_today
  ) assignments on true
  left join lateral (
    select
      count(*) filter (
        where availability.status = 'approved'
          and (
            (availability.leave_type = 'single' and availability.unavailable_date between v_start_date and v_end_date)
            or
            (availability.leave_type = 'range'
              and availability.start_date is not null
              and availability.end_date is not null
              and daterange(availability.start_date, availability.end_date, '[]') && daterange(v_start_date, v_end_date, '[]'))
          )
      ) as approved_leave_count,
      count(*) filter (
        where availability.status = 'pending'
          and (
            (availability.leave_type = 'single' and availability.unavailable_date between v_start_date and v_end_date)
            or
            (availability.leave_type = 'range'
              and availability.start_date is not null
              and availability.end_date is not null
              and daterange(availability.start_date, availability.end_date, '[]') && daterange(v_start_date, v_end_date, '[]'))
          )
      ) as pending_leave_count
    from public.user_availability availability
    where availability.user_id = profile.id
      and availability.org_id = p_org_id
  ) leaves on true
  left join lateral (
    select count(*) as open_discipline_count
    from public.discipline_records record
    where record.user_id = profile.id
      and record.org_id = p_org_id
      and record.status <> 'resolved'
  ) discipline on true
  left join public.organization_member_settings member_settings
    on member_settings.org_id = p_org_id
   and member_settings.user_id = profile.id
  where profile.org_id = p_org_id
    and profile.is_onboarded = true
    and coalesce(member_settings.include_in_attendance, true)
  order by profile.first_name, profile.last_name;
end;
$$;

revoke all on function public.get_org_member_accountability_rollup(uuid, integer, integer)
  from public, anon;
grant execute on function public.get_org_member_accountability_rollup(uuid, integer, integer)
  to authenticated;

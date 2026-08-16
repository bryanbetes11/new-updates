-- Offense levels must follow the written Worship Ministry attendance policy.
-- A missed schedule response remains visible operationally, but only verified
-- absences and late totals contribute to the quarterly offense level.

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
  confirmed_count bigint,
  no_response_count bigint,
  present_count bigint,
  late_count bigint,
  absent_count bigint,
  excused_count bigint,
  needs_review_count bigint,
  dependability_incidents bigint,
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
  with scheduled_events as (
    select distinct on (assignment.user_id, assignment.event_id)
      assignment.user_id,
      assignment.event_id,
      assignment.status as assignment_status
    from public.event_assignments assignment
    join public.events event
      on event.id = assignment.event_id
     and event.org_id = v_org_id
    where assignment.org_id = v_org_id
      and assignment.status <> 'declined'
      and event.event_date between v_start_date and v_end_date
      and event.event_date <= v_finalized_through
    order by assignment.user_id, assignment.event_id,
      case assignment.status when 'confirmed' then 1 else 2 end,
      assignment.created_at,
      assignment.id
  ), member_counts as (
    select
      profile.id as member_id,
      count(scheduled.event_id) as events_assigned,
      count(*) filter (where scheduled.assignment_status = 'confirmed') as confirmed_count,
      count(*) filter (where scheduled.assignment_status = 'pending') as no_response_count,
      count(*) filter (where attendance.review_status = 'verified' and attendance.status = 'present') as present_count,
      count(*) filter (where attendance.review_status = 'verified' and attendance.status = 'late') as late_count,
      count(*) filter (where attendance.review_status = 'verified' and attendance.status = 'absent') as absent_count,
      count(*) filter (where attendance.review_status = 'verified' and attendance.status = 'excused') as excused_count,
      count(*) filter (where scheduled.event_id is not null and (attendance.id is null or attendance.review_status = 'needs_review')) as needs_review_count,
      count(*) filter (
        where attendance.review_status = 'verified'
          and attendance.status = 'absent'
      ) as dependability_incidents
    from public.profiles profile
    left join scheduled_events scheduled on scheduled.user_id = profile.id
    left join public.event_attendance attendance
      on attendance.org_id = v_org_id
     and attendance.event_id = scheduled.event_id
     and attendance.user_id = profile.id
    where profile.org_id = v_org_id
      and profile.is_onboarded = true
    group by profile.id
  )
  select
    profile.id,
    profile.first_name,
    profile.last_name,
    profile.nickname,
    profile.avatar_url,
    profile.ministry_status,
    counts.events_assigned,
    counts.confirmed_count,
    counts.no_response_count,
    counts.present_count,
    counts.late_count,
    counts.absent_count,
    counts.excused_count,
    counts.needs_review_count,
    counts.dependability_incidents,
    public.get_user_offense_level_v2(counts.late_count::integer, counts.dependability_incidents::integer)
  from public.profiles profile
  join member_counts counts on counts.member_id = profile.id
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

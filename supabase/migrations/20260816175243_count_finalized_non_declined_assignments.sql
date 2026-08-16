-- Accountability follows the schedule: once an event is finalized, both
-- confirmed and unanswered assignments count. Declined assignments remain
-- excluded because the member explicitly communicated they would not serve.

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
  with scheduled_events as (
    select distinct assignment.event_id
    from public.event_assignments assignment
    join public.events event
      on event.id = assignment.event_id
     and event.org_id = p_org_id
    where assignment.org_id = p_org_id
      and assignment.user_id = p_user_id
      and assignment.status <> 'declined'
      and event.event_date between p_start_date and p_end_date
      and event.event_date <= p_finalized_through
  )
  select
    count(scheduled.event_id) as events_assigned,
    count(*) filter (where attendance.status = 'present') as present_count,
    count(*) filter (where attendance.status = 'late') as late_count,
    count(*) filter (where coalesce(attendance.status, 'absent') = 'absent') as absent_count,
    count(*) filter (where attendance.status = 'excused') as excused_count
  from scheduled_events scheduled
  left join public.event_attendance attendance
    on attendance.org_id = p_org_id
   and attendance.event_id = scheduled.event_id
   and attendance.user_id = p_user_id;
$$;

revoke all on function private.get_finalized_member_attendance_stats(uuid, uuid, date, date, date)
  from public, anon, authenticated;

create or replace function public.get_member_attendance_history(
  p_user_id uuid,
  p_limit integer default 20,
  p_year integer default null,
  p_quarter integer default null
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
  v_finalized_through date;
  v_start_date date;
  v_end_date date;
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
    from public.profiles profile
    where profile.id = p_user_id
      and profile.org_id = v_org_id
  ) then
    raise exception 'Member not found in current organization';
  end if;

  if (p_year is null) <> (p_quarter is null) then
    raise exception 'Year and quarter must be provided together';
  end if;

  if p_quarter is not null and p_quarter not between 1 and 4 then
    raise exception 'Quarter must be between 1 and 4';
  end if;

  if p_year is not null then
    v_start_date := public.get_quarter_start_date(p_year, p_quarter);
    v_end_date := public.get_quarter_end_date(p_year, p_quarter);
  end if;

  v_finalized_through := timezone('Asia/Manila', now())::date - 2;

  return query
  with scheduled_events as (
    select distinct on (assignment.event_id)
      assignment.event_id,
      assignment.id as fallback_attendance_id
    from public.event_assignments assignment
    join public.events event
      on event.id = assignment.event_id
     and event.org_id = v_org_id
    where assignment.org_id = v_org_id
      and assignment.user_id = p_user_id
      and assignment.status <> 'declined'
      and event.event_date <= v_finalized_through
      and (v_start_date is null or event.event_date between v_start_date and v_end_date)
    order by assignment.event_id, assignment.created_at, assignment.id
  )
  select
    coalesce(attendance.id, scheduled.fallback_attendance_id),
    event.id,
    event.title,
    event.event_date::date,
    event.event_type,
    coalesce(attendance.status, 'absent'),
    attendance.checked_in_at,
    attendance.marked_at,
    attendance.excused_reason,
    coalesce(attendance.notes, 'Calculated absent after the attendance window closed (no attendance submitted)')
  from scheduled_events scheduled
  join public.events event
    on event.id = scheduled.event_id
   and event.org_id = v_org_id
  left join public.event_attendance attendance
    on attendance.event_id = scheduled.event_id
   and attendance.user_id = p_user_id
   and attendance.org_id = v_org_id
  order by event.event_date desc, event.start_time desc
  limit greatest(p_limit, 0);
end;
$$;

revoke all on function public.get_member_attendance_history(uuid, integer, integer, integer)
  from public, anon;
grant execute on function public.get_member_attendance_history(uuid, integer, integer, integer)
  to authenticated;

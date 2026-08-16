-- Keep the member history drill-down consistent with quarterly accountability.
-- Confirmed assignments are authoritative, distinct per member/event, and a
-- missing attendance mark becomes a calculated absence once finalization ends.

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
  v_finalized_through date;
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

  v_finalized_through := timezone('Asia/Manila', now())::date - 2;

  return query
  with confirmed_events as (
    select distinct on (assignment.event_id)
      assignment.event_id,
      assignment.id as fallback_attendance_id
    from public.event_assignments assignment
    join public.events event
      on event.id = assignment.event_id
     and event.org_id = v_org_id
    where assignment.org_id = v_org_id
      and assignment.user_id = p_user_id
      and assignment.status = 'confirmed'
      and event.event_date <= v_finalized_through
    order by assignment.event_id, assignment.created_at, assignment.id
  )
  select
    coalesce(attendance.id, confirmed.fallback_attendance_id),
    event.id,
    event.title,
    event.event_date::date,
    event.event_type,
    coalesce(attendance.status, 'absent'),
    attendance.checked_in_at,
    attendance.marked_at,
    attendance.excused_reason,
    coalesce(attendance.notes, 'Calculated absent after the attendance window closed (no attendance submitted)')
  from confirmed_events confirmed
  join public.events event
    on event.id = confirmed.event_id
   and event.org_id = v_org_id
  left join public.event_attendance attendance
    on attendance.event_id = confirmed.event_id
   and attendance.user_id = p_user_id
   and attendance.org_id = v_org_id
  order by event.event_date desc, event.start_time desc
  limit greatest(p_limit, 0);
end;
$$;

revoke all on function public.get_member_attendance_history(uuid, integer) from public, anon;
grant execute on function public.get_member_attendance_history(uuid, integer) to authenticated;

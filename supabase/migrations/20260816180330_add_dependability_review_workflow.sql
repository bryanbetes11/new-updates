-- Separate verified attendance from automatic inference, and combine missed
-- confirmations with verified absences into one event-level dependability
-- incident (never double-penalizing the same event).

alter table public.event_attendance
  add column if not exists record_source text not null default 'member',
  add column if not exists review_status text not null default 'verified',
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

alter table public.event_attendance
  drop constraint if exists event_attendance_record_source_check,
  drop constraint if exists event_attendance_review_status_check;

alter table public.event_attendance
  add constraint event_attendance_record_source_check
    check (record_source in ('member', 'leader', 'automatic')),
  add constraint event_attendance_review_status_check
    check (review_status in ('verified', 'needs_review'));

update public.event_attendance
set record_source = 'automatic',
    review_status = 'needs_review',
    reviewed_by = null,
    reviewed_at = null
where status = 'absent'
  and notes = 'Auto-marked absent (no attendance submitted)';

create index if not exists event_attendance_review_queue_idx
  on public.event_attendance (org_id, review_status, created_at desc)
  where review_status = 'needs_review';

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
    count(scheduled.event_id),
    count(*) filter (where attendance.review_status = 'verified' and attendance.status = 'present'),
    count(*) filter (where attendance.review_status = 'verified' and attendance.status = 'late'),
    count(*) filter (where attendance.review_status = 'verified' and attendance.status = 'absent'),
    count(*) filter (where attendance.review_status = 'verified' and attendance.status = 'excused')
  from scheduled_events scheduled
  left join public.event_attendance attendance
    on attendance.org_id = p_org_id
   and attendance.event_id = scheduled.event_id
   and attendance.user_id = p_user_id;
$$;

revoke all on function private.get_finalized_member_attendance_stats(uuid, uuid, date, date, date)
  from public, anon, authenticated;

drop function if exists public.get_all_members_attendance_stats(integer, integer);

create function public.get_all_members_attendance_stats(
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
        where scheduled.assignment_status = 'pending'
           or (attendance.review_status = 'verified' and attendance.status = 'absent')
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

drop function if exists public.get_member_attendance_history(uuid, integer, integer, integer);

create function public.get_member_attendance_history(
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
  assignment_status text,
  status text,
  review_status text,
  record_source text,
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
      assignment.event_id,
      assignment.id as fallback_attendance_id,
      assignment.status as assignment_status
    from public.event_assignments assignment
    join public.events event on event.id = assignment.event_id and event.org_id = v_org_id
    where assignment.org_id = v_org_id
      and assignment.user_id = p_user_id
      and assignment.status <> 'declined'
      and event.event_date <= v_finalized_through
      and (v_start_date is null or event.event_date between v_start_date and v_end_date)
    order by assignment.event_id,
      case assignment.status when 'confirmed' then 1 else 2 end,
      assignment.created_at,
      assignment.id
  )
  select
    coalesce(attendance.id, scheduled.fallback_attendance_id),
    event.id,
    event.title,
    event.event_date::date,
    event.event_type,
    scheduled.assignment_status,
    case when attendance.id is null or attendance.review_status = 'needs_review' then 'needs_review' else attendance.status end,
    coalesce(attendance.review_status, 'needs_review'),
    coalesce(attendance.record_source, 'automatic'),
    attendance.checked_in_at,
    attendance.marked_at,
    attendance.excused_reason,
    attendance.notes
  from scheduled_events scheduled
  join public.events event on event.id = scheduled.event_id and event.org_id = v_org_id
  left join public.event_attendance attendance
    on attendance.event_id = scheduled.event_id
   and attendance.user_id = p_user_id
   and attendance.org_id = v_org_id
  order by event.event_date desc, event.start_time desc
  limit greatest(p_limit, 0);
end;
$$;

revoke all on function public.get_member_attendance_history(uuid, integer, integer, integer) from public, anon;
grant execute on function public.get_member_attendance_history(uuid, integer, integer, integer) to authenticated;

create or replace function public.resolve_attendance_review(
  p_event_id uuid,
  p_user_id uuid,
  p_status text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
begin
  if not (public.auth_is_org_admin() or public.auth_is_org_leader()) then
    raise exception 'Not authorized to resolve attendance';
  end if;
  if p_status not in ('present', 'late', 'absent', 'excused') then
    raise exception 'Invalid attendance resolution';
  end if;
  if p_status = 'excused' and nullif(btrim(coalesce(p_note, '')), '') is null then
    raise exception 'An explanation is required for excused attendance';
  end if;

  v_org_id := public.auth_org_id();
  if not exists (
    select 1
    from public.event_assignments assignment
    join public.events event on event.id = assignment.event_id and event.org_id = v_org_id
    where assignment.org_id = v_org_id
      and assignment.event_id = p_event_id
      and assignment.user_id = p_user_id
      and assignment.status <> 'declined'
  ) then
    raise exception 'Scheduled assignment not found';
  end if;

  insert into public.event_attendance (
    event_id, user_id, org_id, status, is_assigned, notes, excused_reason,
    record_source, review_status, reviewed_by, reviewed_at,
    marked_by, marked_at, override_by, override_at
  ) values (
    p_event_id, p_user_id, v_org_id, p_status, true,
    nullif(btrim(coalesce(p_note, '')), ''),
    case when p_status = 'excused' then nullif(btrim(coalesce(p_note, '')), '') else null end,
    'leader', 'verified', auth.uid(), now(), auth.uid(), now(), auth.uid(), now()
  )
  on conflict (event_id, user_id) do update
  set status = excluded.status,
      is_assigned = true,
      notes = excluded.notes,
      excused_reason = excluded.excused_reason,
      record_source = 'leader',
      review_status = 'verified',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      marked_by = auth.uid(),
      marked_at = now(),
      override_by = auth.uid(),
      override_at = now(),
      updated_at = now();
end;
$$;

revoke all on function public.resolve_attendance_review(uuid, uuid, text, text) from public, anon;
grant execute on function public.resolve_attendance_review(uuid, uuid, text, text) to authenticated;

-- Leaders need to see every scheduled member at the event, including those
-- who have not responded yet, so attendance can still be verified accurately.
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
  if v_org_id is null then raise exception 'No organization selected'; end if;
  if not (public.auth_is_org_admin() or public.auth_is_org_leader()) then
    raise exception 'Not authorized to view attendance roster';
  end if;
  if not exists (select 1 from public.events where id = p_event_id and org_id = v_org_id) then
    raise exception 'Event not found in current organization';
  end if;

  return query
  with scheduled_members as (
    select
      assignment.user_id,
      string_agg(distinct role.name, ', ' order by role.name) as role_names
    from public.event_assignments assignment
    join public.roles role on role.id = assignment.role_id
    where assignment.event_id = p_event_id
      and assignment.org_id = v_org_id
      and assignment.status <> 'declined'
    group by assignment.user_id
  )
  select
    profile.id,
    profile.first_name,
    profile.last_name,
    profile.nickname,
    profile.avatar_url,
    profile.gender,
    scheduled.role_names,
    attendance.id,
    case when attendance.review_status = 'needs_review' then null else attendance.status end,
    attendance.checked_in_at,
    attendance.marked_at,
    attendance.excused_reason,
    attendance.notes,
    true
  from scheduled_members scheduled
  join public.profiles profile on profile.id = scheduled.user_id and profile.org_id = v_org_id
  left join public.event_attendance attendance
    on attendance.event_id = p_event_id
   and attendance.user_id = profile.id
   and attendance.org_id = v_org_id
  order by profile.first_name, profile.last_name;
end;
$$;

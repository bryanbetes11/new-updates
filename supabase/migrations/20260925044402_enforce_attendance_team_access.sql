-- Deploy the membership foundation and assign teams before this cutover.
-- Unassigned members intentionally remain visible only to themselves/admins.
create schema if not exists private;
create or replace function private.can_manage_member_attendance(p_viewer uuid, p_member uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles viewer
    join public.profiles member on member.org_id = viewer.org_id
    where viewer.id = p_viewer and member.id = p_member
      and viewer.org_id is not null
      and (viewer.is_org_admin or exists (
        select 1 from public.attendance_team_memberships membership
        join public.attendance_leader_scopes scope on scope.org_id=membership.org_id
          and scope.team=membership.team and scope.user_id=viewer.id
        join public.user_roles assignment on assignment.org_id = membership.org_id
          and assignment.user_id = viewer.id
        join public.roles role on role.id = assignment.role_id and role.is_leadership
        where membership.user_id = member.id and membership.org_id = member.org_id
      ))
  );
$$;
revoke all on function private.can_manage_member_attendance(uuid, uuid) from public, anon, authenticated;

create or replace function public.auth_can_manage_member_attendance(p_member uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_manage_member_attendance(auth.uid(), p_member);
$$;
create or replace function public.auth_can_view_member_attendance(p_member uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.can_manage_member_attendance(auth.uid(), p_member)
    or exists (select 1 from public.profiles p
      where p.id = auth.uid() and p.id = p_member and p.org_id is not null);
$$;
revoke all on function public.auth_can_manage_member_attendance(uuid) from public, anon;
revoke all on function public.auth_can_view_member_attendance(uuid) from public, anon;
grant execute on function public.auth_can_manage_member_attendance(uuid) to authenticated;
grant execute on function public.auth_can_view_member_attendance(uuid) to authenticated;

-- Restrictive policies also constrain any pre-existing permissive leader policy.
create policy "Attendance reads require member scope" on public.event_attendance
as restrictive for select to authenticated using (
  org_id = (select public.auth_org_id())
  and public.auth_can_view_member_attendance(user_id)
  and exists (select 1 from public.events e where e.id = event_id and e.org_id = (select public.auth_org_id()))
);
create policy "Attendance inserts require team scope" on public.event_attendance
as restrictive for insert to authenticated with check (
  org_id = (select public.auth_org_id()) and public.auth_can_manage_member_attendance(user_id)
  and exists (select 1 from public.events e where e.id = event_id and e.org_id = (select public.auth_org_id()))
);
create policy "Attendance updates require team scope" on public.event_attendance
as restrictive for update to authenticated using (
  org_id = (select public.auth_org_id()) and public.auth_can_manage_member_attendance(user_id)
) with check (
  org_id = (select public.auth_org_id()) and public.auth_can_manage_member_attendance(user_id)
  and exists (select 1 from public.events e where e.id = event_id and e.org_id = (select public.auth_org_id()))
);
create policy "Church admins can select attendance" on public.event_attendance
for select to authenticated using (org_id = (select public.auth_org_id()) and (select public.auth_is_org_admin()));
create policy "Church admins can insert attendance" on public.event_attendance
for insert to authenticated
with check (org_id = (select public.auth_org_id()) and (select public.auth_is_org_admin()));
create policy "Church admins can update attendance" on public.event_attendance
for update to authenticated using (org_id = (select public.auth_org_id()) and (select public.auth_is_org_admin()))
with check (org_id = (select public.auth_org_id()) and (select public.auth_is_org_admin()));

create policy "Offense records require team scope" on public.attendance_offense_notifications
as restrictive for all to authenticated using (
  org_id = (select public.auth_org_id()) and public.auth_can_manage_member_attendance(user_id)
) with check (
  org_id = (select public.auth_org_id()) and public.auth_can_manage_member_attendance(user_id)
);
create policy "Attendance discipline reads require member scope" on public.discipline_records
as restrictive for select to authenticated using (
  source <> 'attendance' or public.auth_can_view_member_attendance(user_id)
);
create policy "Attendance discipline inserts require team scope" on public.discipline_records
as restrictive for insert to authenticated with check (
  source <> 'attendance' or public.auth_can_manage_member_attendance(user_id)
);
create policy "Attendance discipline updates require team scope" on public.discipline_records
as restrictive for update to authenticated using (
  source <> 'attendance' or public.auth_can_manage_member_attendance(user_id)
) with check (
  source <> 'attendance' or public.auth_can_manage_member_attendance(user_id)
);

-- Safely parse old notification metadata; malformed alerts fail closed.
create or replace function public.auth_can_view_attendance_alert(p_data jsonb)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_member uuid;
begin
  begin v_member := (p_data ->> 'offense_user_id')::uuid;
  exception when invalid_text_representation then return false; end;
  return public.auth_can_manage_member_attendance(v_member);
end;
$$;
revoke all on function public.auth_can_view_attendance_alert(jsonb) from public, anon;
grant execute on function public.auth_can_view_attendance_alert(jsonb) to authenticated;
create policy "Attendance alerts require current team scope" on public.notifications
as restrictive for select to authenticated using (
  (type <> 'attendance_alert' or public.auth_can_view_attendance_alert(data))
  and (type <> 'leadership_member_action_reminder' or (select public.auth_is_org_admin()))
);

-- Push previews must not disclose a named member's attendance, including queued
-- legacy alerts. The canonical attendance rows and offense history are retained.
update public.notifications set title = 'Attendance review',
  body = 'Attendance records need review. Open ServeSync to view records you can access.',
  data = jsonb_build_object('offense_user_id', data ->> 'offense_user_id', 'url', '/manage?tab=attendance')
where type = 'attendance_alert';

update public.notifications set title = 'Members Need Follow-Up',
  body = 'Member records need review. Open ServeSync to view records you can access.',
  data = jsonb_build_object('url', '/leadership/team', 'reminder_key', data ->> 'reminder_key')
where type = 'leadership_member_action_reminder';

-- Also protect service-role writes and older job deployments. Push delivery
-- bypasses SELECT policies, so previews and recipients must be safe at creation.
create or replace function private.guard_attendance_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_member uuid;
begin
  if new.type = 'attendance_alert' then
    begin v_member := (new.data ->> 'offense_user_id')::uuid;
    exception when invalid_text_representation then return null; end;
    if not private.can_manage_member_attendance(new.user_id, v_member)
      or not exists (select 1 from public.profiles p where p.id = new.user_id and p.org_id = new.org_id)
      then return null; end if;
    new.title := 'Attendance review';
    new.body := 'Attendance records need review. Open ServeSync to view records you can access.';
    new.data := jsonb_build_object('offense_user_id', v_member, 'url', '/manage?tab=attendance');
  elsif new.type = 'leadership_member_action_reminder' then
    if not exists (select 1 from public.profiles p where p.id = new.user_id and p.org_id = new.org_id and p.is_org_admin)
      then return null; end if;
    new.title := 'Members Need Follow-Up';
    new.body := 'Member records need review. Open ServeSync to view records you can access.';
    new.data := jsonb_build_object('url', '/leadership/team', 'reminder_key', new.data ->> 'reminder_key');
  end if;
  return new;
end;
$$;
revoke all on function private.guard_attendance_notification() from public, anon, authenticated;
create trigger zz_guard_attendance_notification before insert or update on public.notifications
for each row execute function private.guard_attendance_notification();

-- Delivery analytics retain titles even after inbox deletion. Personal check-in
-- titles identify their recipient, so the admin activity view needs this gate too.
create policy "Attendance delivery activity requires scope" on public.notification_activity
as restrictive for select to authenticated using (
  case
    when notification_type in ('attendance_alert', 'leadership_member_action_reminder')
      then (select public.auth_is_org_admin())
    when notification_type in ('attendance_auto_absent', 'attendance_qr_recorded', 'attendance_scan_incomplete')
      then public.auth_can_manage_member_attendance(user_id)
    else true
  end
);
update public.notification_activity set title = 'Attendance review' where notification_type = 'attendance_alert';


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
      and public.auth_can_manage_member_attendance(profile.id)
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
  if not public.auth_can_view_member_attendance(p_user_id) then
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
  where public.auth_can_manage_member_attendance(profile.id)
  order by profile.first_name, profile.last_name;
end;
$$;

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
  if not public.auth_can_manage_member_attendance(p_user_id) then
    raise exception 'Not authorized to resolve attendance';
  end if;
  if p_status is null or p_status not in ('present', 'late', 'absent', 'excused') then
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

revoke all on function public.get_all_members_attendance_stats(integer, integer) from public, anon;
grant execute on function public.get_all_members_attendance_stats(integer, integer) to authenticated;

revoke all on function public.get_member_attendance_history(uuid, integer, integer, integer) from public, anon;
grant execute on function public.get_member_attendance_history(uuid, integer, integer, integer) to authenticated;

revoke all on function public.get_event_attendance_roster(uuid) from public, anon;
grant execute on function public.get_event_attendance_roster(uuid) to authenticated;

revoke all on function public.resolve_attendance_review(uuid, uuid, text, text) from public, anon;
grant execute on function public.resolve_attendance_review(uuid, uuid, text, text) to authenticated;

create policy "Church admins can read offense records" on public.attendance_offense_notifications
for select to authenticated using (org_id = (select public.auth_org_id()) and (select public.auth_is_org_admin()));
create policy "Church admins can read attendance discipline" on public.discipline_records
for select to authenticated using (source = 'attendance' and org_id = (select public.auth_org_id()) and (select public.auth_is_org_admin()));
create policy "Church admins can insert attendance discipline" on public.discipline_records
for insert to authenticated with check (source = 'attendance' and org_id = (select public.auth_org_id()) and (select public.auth_is_org_admin()));
create policy "Church admins can update attendance discipline" on public.discipline_records
for update to authenticated using (source = 'attendance' and org_id = (select public.auth_org_id()) and (select public.auth_is_org_admin()))
with check (source = 'attendance' and org_id = (select public.auth_org_id()) and (select public.auth_is_org_admin()));

-- The administrative activity feed must not become a second attendance report.
-- Existing feed policies continue to decide who can open other activity types.
create policy "Attendance activity requires team scope" on public.activity_logs
as restrictive for select to authenticated using (
  (category not in ('attendance', 'accountability') and entity_type not in ('event_attendance', 'discipline_record')
    and action not like 'attendance.%' and action not like 'accountability.%')
  or (org_id = (select public.auth_org_id()) and public.auth_can_manage_member_attendance(target_user_id))
);

create or replace function public.on_attendance_recorded()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_event_date date;
  v_quarter integer;
  v_year integer;
  v_late_count integer;
  v_absent_count integer;
  v_offense_level integer;
  v_previous_offense_level integer;
  v_recipient_id uuid;
begin
  -- A pending review must not trigger an offense notification.
  if new.status not in ('late', 'absent') or new.is_assigned is not true
    or new.review_status is distinct from 'verified' then return new; end if;
  select event_date into v_event_date from public.events
    where id = new.event_id and org_id = new.org_id;
  if v_event_date is null then return new; end if;
  v_quarter := public.get_quarter_from_date(v_event_date);
  v_year := extract(year from v_event_date)::integer;
  select count(*) filter (where att.status = 'late'), count(*) filter (where att.status = 'absent')
  into v_late_count, v_absent_count
  from public.event_attendance att
  join public.events e on e.id = att.event_id and e.org_id = new.org_id
  where att.user_id = new.user_id and att.org_id = new.org_id
    and att.is_assigned = true and att.review_status = 'verified'
    and e.event_date between public.get_quarter_start_date(v_year, v_quarter) and public.get_quarter_end_date(v_year, v_quarter);
  -- Use the same verified-absence rule as the attendance report.
  v_offense_level := public.get_user_offense_level_v2(v_late_count, v_absent_count);
  if v_offense_level = 0 then return new; end if;
  select max(offense_level) into v_previous_offense_level
  from public.attendance_offense_notifications
  where user_id = new.user_id and org_id = new.org_id
    and quarter_year = v_year and quarter_number = v_quarter;
  if v_previous_offense_level is not null and v_previous_offense_level >= v_offense_level then return new; end if;

  for v_recipient_id in
    select p.id from public.profiles p where p.org_id = new.org_id
      and private.can_manage_member_attendance(p.id, new.user_id)
  loop
    perform public.create_notification(v_recipient_id, 'attendance_alert', 'Attendance review',
      'Attendance records need review. Open ServeSync to view records you can access.',
      jsonb_build_object('offense_user_id', new.user_id, 'url', '/manage?tab=attendance'));
  end loop;
  insert into public.attendance_offense_notifications(user_id, org_id, quarter_year, quarter_number, offense_level)
  values (new.user_id, new.org_id, v_year, v_quarter, v_offense_level)
  on conflict (user_id, quarter_year, quarter_number, offense_level) do nothing;
  return new;
end;
$$;
revoke all on function public.on_attendance_recorded() from public, anon, authenticated;

-- Called by member summaries as well as the trusted daily reminder job.
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
  if coalesce(auth.role(), '') <> 'service_role' and (auth.uid() is null or p_org_id is distinct from public.auth_org_id()) then
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
    and (coalesce(auth.role(), '') = 'service_role' or public.auth_can_view_member_attendance(profile.id))
    and profile.is_onboarded = true
    and coalesce(member_settings.include_in_attendance, true)
  order by profile.first_name, profile.last_name;
end;
$$;
revoke all on function public.get_org_member_accountability_rollup(uuid, integer, integer) from public, anon;
grant execute on function public.get_org_member_accountability_rollup(uuid, integer, integer) to authenticated, service_role;

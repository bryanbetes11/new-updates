-- Atomic replacement uses the caller's existing RLS permissions and the normal
-- assignment insert/delete triggers (notifications, song leader, linked teams).
create or replace function public.replace_inactive_event_assignment(p_assignment_id uuid, p_new_user_id uuid)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  old_assignment public.event_assignments%rowtype;
  scheduled_event public.events%rowtype;
  replacement_id uuid;
  role_name text;
begin
  if auth.uid() is null or not coalesce(public.auth_is_org_leader(), false) then
    raise exception 'Church leadership access required' using errcode='42501';
  end if;
  select * into old_assignment from public.event_assignments
    where id=p_assignment_id and org_id=public.auth_org_id() for update;
  if not found then raise exception 'Assignment changed or is unavailable. Refresh and try again.'; end if;
  select * into scheduled_event from public.events where id=old_assignment.event_id and org_id=old_assignment.org_id for share;
  if not found or scheduled_event.lifecycle_override='completed'
    or (scheduled_event.event_date + coalesce(scheduled_event.end_time,scheduled_event.start_time,'23:59'::time)) at time zone 'Asia/Manila' <= now()
  then raise exception 'Only upcoming assignments can be replaced.'; end if;
  if old_assignment.source_assignment_id is not null then
    raise exception 'Replace this linked assignment on its source service first.';
  end if;
  if exists(select 1 from public.event_assignments a join public.events e on e.id=a.event_id
    where a.source_assignment_id=old_assignment.id and
      (e.lifecycle_override='completed' or (e.event_date + coalesce(e.end_time,e.start_time,'23:59'::time)) at time zone 'Asia/Manila' <= now()))
  then raise exception 'This assignment has past linked rehearsals. Review it manually to preserve history.'; end if;
  perform 1 from public.profiles where id=old_assignment.user_id and org_id=old_assignment.org_id and ministry_status='inactive' for share;
  if not found or old_assignment.status='declined' then raise exception 'This member no longer needs an inactive assignment replacement.'; end if;
  perform 1 from public.profiles where id=p_new_user_id and org_id=old_assignment.org_id and ministry_status='active' for share;
  if not found then raise exception 'Choose an active member from this church.'; end if;
  if exists(select 1 from public.organization_member_settings where org_id=old_assignment.org_id and user_id=p_new_user_id and not include_in_assignments) then
    raise exception 'This member is excluded from assignments.';
  end if;
  select name into role_name from public.roles where id=old_assignment.role_id;
  if role_name is null or (role_name not in ('Participant','All Members') and not exists(
    select 1 from public.user_roles where org_id=old_assignment.org_id and user_id=p_new_user_id and role_id=old_assignment.role_id
  )) then raise exception 'Choose a member who serves in this role.'; end if;
  if exists(select 1 from public.user_availability where user_id=p_new_user_id and org_id=old_assignment.org_id
    and status='approved' and coalesce(request_type,'leave')='leave'
    and ((leave_type='range' and scheduled_event.event_date between start_date and end_date)
      or (coalesce(leave_type,'single')<>'range' and unavailable_date=scheduled_event.event_date))) then
    raise exception 'This member is marked Out on the event date.';
  end if;
  if exists(select 1 from public.event_assignments where event_id=old_assignment.event_id and user_id=p_new_user_id and role_id=old_assignment.role_id) then
    raise exception 'This member is already assigned to this role.';
  end if;
  delete from public.event_assignments where id=old_assignment.id;
  if not found then raise exception 'Could not remove the original assignment.'; end if;
  insert into public.event_assignments(org_id,event_id,user_id,role_id,status)
    values(old_assignment.org_id,old_assignment.event_id,p_new_user_id,old_assignment.role_id,'pending') returning id into replacement_id;
  return replacement_id;
end;
$$;
revoke all on function public.replace_inactive_event_assignment(uuid,uuid) from public,anon;
grant execute on function public.replace_inactive_event_assignment(uuid,uuid) to authenticated;

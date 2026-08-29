-- Let an organization admin grant attendance consideration for either an
-- entire quarter or one month within that quarter, without deleting history.

drop function if exists public.reset_team_attendance_for_consideration(integer, integer, text);

create function public.reset_team_attendance_for_consideration(
  p_year integer,
  p_quarter integer,
  p_month integer,
  p_reason text
)
returns table (
  updated_records bigint,
  created_records bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_start_date date;
  v_end_date date;
  v_finalized_through date;
  v_reason text;
  v_updated_records bigint := 0;
  v_created_records bigint := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not (
    coalesce(public.auth_is_org_admin(), false)
    or coalesce(public.is_platform_owner(), false)
  ) then
    raise exception 'Only organization admins can reset team attendance';
  end if;

  if p_quarter not between 1 and 4 then
    raise exception 'Quarter must be between 1 and 4';
  end if;

  if p_month is not null and p_month not between 1 and 12 then
    raise exception 'Month must be between 1 and 12';
  end if;

  if p_month is not null and ceil(p_month / 3.0)::integer <> p_quarter then
    raise exception 'The selected month must belong to the selected quarter';
  end if;

  v_reason := nullif(btrim(coalesce(p_reason, '')), '');
  if v_reason is null or char_length(v_reason) < 8 then
    raise exception 'A consideration reason of at least 8 characters is required';
  end if;
  if char_length(v_reason) > 500 then
    raise exception 'Consideration reason must not exceed 500 characters';
  end if;

  v_org_id := public.auth_org_id();
  if v_org_id is null then
    raise exception 'No organization selected';
  end if;

  if p_month is null then
    v_start_date := public.get_quarter_start_date(p_year, p_quarter);
    v_end_date := public.get_quarter_end_date(p_year, p_quarter);
  else
    v_start_date := make_date(p_year, p_month, 1);
    v_end_date := (v_start_date + interval '1 month - 1 day')::date;
  end if;

  if v_start_date > timezone('Asia/Manila', now())::date then
    raise exception 'A future attendance period cannot be reset';
  end if;
  v_finalized_through := least(v_end_date, timezone('Asia/Manila', now())::date - 2);

  with updated as (
    update public.event_attendance attendance
    set status = 'excused',
        excused_reason = v_reason,
        notes = v_reason,
        record_source = 'leader',
        review_status = 'verified',
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        marked_by = auth.uid(),
        marked_at = now(),
        override_by = auth.uid(),
        override_at = now(),
        updated_at = now()
    from public.events event
    where attendance.org_id = v_org_id
      and event.org_id = v_org_id
      and event.id = attendance.event_id
      and event.event_date between v_start_date and v_end_date
      and event.event_date <= v_finalized_through
      and attendance.status in ('late', 'absent')
    returning attendance.id
  )
  select count(*) into v_updated_records from updated;

  with confirmed_assignments as (
    select distinct assignment.event_id, assignment.user_id
    from public.event_assignments assignment
    join public.events event
      on event.id = assignment.event_id
     and event.org_id = v_org_id
    join public.profiles profile
      on profile.id = assignment.user_id
     and profile.org_id = v_org_id
     and profile.is_onboarded = true
    left join public.organization_member_settings member_settings
      on member_settings.org_id = v_org_id
     and member_settings.user_id = assignment.user_id
    where assignment.org_id = v_org_id
      and assignment.status = 'confirmed'
      and event.event_date between v_start_date and v_end_date
      and event.event_date <= v_finalized_through
      and coalesce(member_settings.include_in_attendance, true)
  ), inserted as (
    insert into public.event_attendance (
      event_id,
      user_id,
      org_id,
      status,
      is_assigned,
      notes,
      excused_reason,
      record_source,
      review_status,
      reviewed_by,
      reviewed_at,
      marked_by,
      marked_at,
      override_by,
      override_at
    )
    select
      assignment.event_id,
      assignment.user_id,
      v_org_id,
      'excused',
      true,
      v_reason,
      v_reason,
      'leader',
      'verified',
      auth.uid(),
      now(),
      auth.uid(),
      now(),
      auth.uid(),
      now()
    from confirmed_assignments assignment
    on conflict (event_id, user_id) do nothing
    returning id
  )
  select count(*) into v_created_records from inserted;

  -- Alert tracking is quarter-based, so clear it even for a monthly reset. The
  -- next alert run recalculates the quarter from the preserved attendance rows.
  delete from public.attendance_offense_notifications notification
  where notification.org_id = v_org_id
    and notification.quarter_year = p_year
    and notification.quarter_number = p_quarter;

  return query select v_updated_records, v_created_records;
end;
$$;

revoke all on function public.reset_team_attendance_for_consideration(integer, integer, integer, text)
  from public, anon;
grant execute on function public.reset_team_attendance_for_consideration(integer, integer, integer, text)
  to authenticated;

comment on function public.reset_team_attendance_for_consideration(integer, integer, integer, text) is
  'Admin-only, tenant-scoped monthly or quarterly attendance consideration. Preserves history by excusing accountable outcomes instead of deleting records.';

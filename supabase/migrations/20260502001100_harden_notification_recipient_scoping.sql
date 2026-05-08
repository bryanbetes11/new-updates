-- ============================================================================
-- Hardening phase 2: notification recipient scoping
-- ----------------------------------------------------------------------------
-- Purpose:
--   * ensure notification helper functions stay tenant-safe as new churches join
--   * scope broadcast-style triggers to the source organization
--   * scope role-based notification recipients to the matching organization
-- ============================================================================

-- ---- core helpers -----------------------------------------------------------

create or replace function public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_data jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
begin
  select p.org_id
  into v_org_id
  from public.profiles p
  where p.id = p_user_id;

  insert into public.notifications (user_id, org_id, type, title, body, data)
  values (p_user_id, v_org_id, p_type, p_title, p_body, coalesce(p_data, '{}'::jsonb));
end;
$$;

create or replace function public.notify_all_except(
  p_exclude_user uuid,
  p_type text,
  p_title text,
  p_body text,
  p_data jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
begin
  select p.org_id
  into v_org_id
  from public.profiles p
  where p.id = p_exclude_user;

  insert into public.notifications (user_id, org_id, type, title, body, data)
  select p.id, p.org_id, p_type, p_title, p_body, coalesce(p_data, '{}'::jsonb)
  from public.profiles p
  where p.id != p_exclude_user
    and p.org_id = v_org_id;
end;
$$;

-- ---- leave request notifications -------------------------------------------

create or replace function public.on_leave_request_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_name text;
  v_date_text text;
  v_body text;
  v_requester_org_id uuid;
  v_leader record;
begin
  select first_name || ' ' || last_name, org_id
  into v_user_name, v_requester_org_id
  from public.profiles
  where id = new.user_id;

  if new.leave_type = 'single' and new.unavailable_date is not null then
    v_date_text := 'on ' || to_char(new.unavailable_date, 'Mon DD, YYYY');
  elsif new.leave_type = 'range' and new.start_date is not null and new.end_date is not null then
    v_date_text := 'from ' || to_char(new.start_date, 'Mon DD') || ' to ' || to_char(new.end_date, 'Mon DD, YYYY');
  else
    v_date_text := 'for an unavailable period';
  end if;

  v_body := v_user_name || ' requested to be unavailable ' || v_date_text;
  if new.reason is not null and new.reason != '' then
    v_body := v_body || ' -- ' || new.reason;
  end if;

  for v_leader in
    select distinct ur.user_id
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where r.is_leadership = true
      and ur.user_id != new.user_id
      and ur.org_id = v_requester_org_id
  loop
    perform public.create_notification(
      v_leader.user_id,
      'leave_request',
      'New Unavailable Day Request',
      v_body,
      jsonb_build_object(
        'leave_id', new.id::text,
        'user_id', new.user_id::text,
        'type', 'leave_request',
        'url', '/unavailable-requests'
      )
    );
  end loop;

  return new;
end;
$$;

-- ---- attendance offense notifications --------------------------------------

create or replace function public.on_attendance_recorded()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_date date;
  v_quarter integer;
  v_year integer;
  v_late_count integer;
  v_absent_count integer;
  v_offense_level integer;
  v_previous_offense_level integer;
  v_user_name text;
  v_notification_title text;
  v_notification_body text;
  v_action_required text;
  v_recipient_id uuid;
  v_offense_reason text;
begin
  if new.status not in ('late', 'absent') or new.is_assigned = false then
    return new;
  end if;

  select event_date
  into v_event_date
  from public.events
  where id = new.event_id;

  v_quarter := public.get_quarter_from_date(v_event_date);
  v_year := extract(year from v_event_date)::integer;

  select
    coalesce(sum(case when att.status = 'late' then 1 else 0 end), 0),
    coalesce(sum(case when att.status = 'absent' then 1 else 0 end), 0)
  into v_late_count, v_absent_count
  from public.event_attendance att
  join public.events e on e.id = att.event_id
  where att.user_id = new.user_id
    and att.is_assigned = true
    and e.event_date between public.get_quarter_start_date(v_year, v_quarter) and public.get_quarter_end_date(v_year, v_quarter);

  v_offense_level := public.get_user_offense_level(v_late_count, v_absent_count);
  if v_offense_level = 0 then
    return new;
  end if;

  select max(offense_level)
  into v_previous_offense_level
  from public.attendance_offense_notifications
  where user_id = new.user_id
    and quarter_year = v_year
    and quarter_number = v_quarter;

  if v_previous_offense_level is not null and v_previous_offense_level >= v_offense_level then
    return new;
  end if;

  select concat(first_name, ' ', last_name)
  into v_user_name
  from public.profiles
  where id = new.user_id;

  if v_absent_count >= v_offense_level then
    v_offense_reason := v_absent_count || ' absence' || case when v_absent_count > 1 then 's' else '' end;
  else
    v_offense_reason := v_late_count || ' late' || case when v_late_count > 1 then 's' else '' end;
  end if;

  case v_offense_level
    when 1 then
      v_notification_title := 'Attendance Alert';
      v_action_required := 'Verbal Warning by Admin Coordinator or Music Director';
    when 2 then
      v_notification_title := 'Attendance Alert';
      v_action_required := 'Verbal Warning by Production Director';
    when 3 then
      v_notification_title := 'Attendance Alert';
      v_action_required := 'Counselling session with Pastors';
    when 4 then
      v_notification_title := 'URGENT - Attendance Alert';
      v_action_required := 'Suspension';
  end case;

  v_notification_body := v_user_name || ' has reached ' ||
    case v_offense_level
      when 1 then '1st'
      when 2 then '2nd'
      when 3 then '3rd'
      when 4 then '4th'
    end || ' Offense (' || v_offense_reason || ') for Q' || v_quarter || ' ' || v_year ||
    '. Action required: ' || v_action_required || '.';

  if v_offense_level = 1 then
    for v_recipient_id in
      select ur.user_id
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where r.name in ('Admin Coordinator', 'Music Director')
        and ur.org_id = new.org_id
    loop
      perform public.create_notification(
        v_recipient_id,
        'attendance_alert',
        v_notification_title,
        v_notification_body,
        jsonb_build_object(
          'offense_user_id', new.user_id,
          'offense_level', v_offense_level,
          'url', '/manage?tab=attendance'
        )
      );
    end loop;
  elsif v_offense_level in (2, 3) then
    for v_recipient_id in
      select ur.user_id
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where r.name = 'Production Director'
        and ur.org_id = new.org_id
    loop
      perform public.create_notification(
        v_recipient_id,
        'attendance_alert',
        v_notification_title,
        v_notification_body,
        jsonb_build_object(
          'offense_user_id', new.user_id,
          'offense_level', v_offense_level,
          'url', '/manage?tab=attendance'
        )
      );
    end loop;
  elsif v_offense_level = 4 then
    for v_recipient_id in
      select distinct ur.user_id
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where r.is_leadership = true
        and ur.org_id = new.org_id
    loop
      perform public.create_notification(
        v_recipient_id,
        'attendance_alert',
        v_notification_title,
        v_notification_body,
        jsonb_build_object(
          'offense_user_id', new.user_id,
          'offense_level', v_offense_level,
          'url', '/manage?tab=attendance'
        )
      );
    end loop;
  end if;

  insert into public.attendance_offense_notifications (user_id, org_id, quarter_year, quarter_number, offense_level)
  values (new.user_id, new.org_id, v_year, v_quarter, v_offense_level)
  on conflict (user_id, quarter_year, quarter_number, offense_level) do nothing;

  return new;
end;
$$;

-- ---- announcement comment notifications ------------------------------------

create or replace function public.on_comment_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_announcement record;
  v_commenter_name text;
  v_recipient_id uuid;
begin
  select *
  into v_announcement
  from public.announcements
  where id = new.announcement_id;

  select first_name || ' ' || last_name
  into v_commenter_name
  from public.profiles
  where id = new.user_id;

  for v_recipient_id in
    select p.id
    from public.profiles p
    where p.id != new.user_id
      and p.org_id = v_announcement.org_id
      and (
        v_announcement.is_leaders_only is not true
        or exists (
          select 1
          from public.user_roles ur
          join public.roles r on r.id = ur.role_id
          where ur.user_id = p.id
            and ur.org_id = v_announcement.org_id
            and r.name in (
              'Admin Coordinator',
              'Music Director',
              'Stage Director',
              'Production Director',
              'Setlist Coordinator'
            )
        )
      )
  loop
    perform public.create_notification(
      v_recipient_id,
      'comment',
      'New Comment',
      v_commenter_name || ' commented on "' || v_announcement.title || '"',
      jsonb_build_object(
        'announcement_id', new.announcement_id::text,
        'url', '/announcements/' || new.announcement_id::text
      )
    );
  end loop;

  return new;
end;
$$;

-- ---- announcement mention notifications ------------------------------------

create or replace function public.on_announcement_comment_mention()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_commenter_name text;
  v_announcement_title text;
  v_announcement_org_id uuid;
  v_mentioned_user_id uuid;
begin
  select first_name || ' ' || last_name
  into v_commenter_name
  from public.profiles
  where id = new.user_id;

  select title, org_id
  into v_announcement_title, v_announcement_org_id
  from public.announcements
  where id = new.announcement_id;

  for v_mentioned_user_id in
    select em.user_id
    from public.extract_mentions(new.content) em
    join public.profiles p on p.id = em.user_id
    where em.user_id <> new.user_id
      and p.org_id = v_announcement_org_id
  loop
    perform public.create_notification(
      v_mentioned_user_id,
      'mention',
      'You were mentioned',
      v_commenter_name || ' mentioned you in a comment on "' || v_announcement_title || '".',
      jsonb_build_object(
        'announcement_id', new.announcement_id::text,
        'comment_id', new.id::text,
        'url', '/announcements/' || new.announcement_id::text
      )
    );
  end loop;

  return new;
end;
$$;

create or replace function public.on_announcement_mention()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_creator_name text;
  v_combined_text text := '';
  v_mentioned_user_id uuid;
begin
  select first_name || ' ' || last_name
  into v_creator_name
  from public.profiles
  where id = new.created_by;

  if new.content_blocks is not null then
    select string_agg(b->>'content', ' ')
    into v_combined_text
    from jsonb_array_elements(new.content_blocks) as b
    where b->>'type' = 'text';
  end if;

  v_combined_text := coalesce(v_combined_text, '') || ' ' || coalesce(new.content, '');

  for v_mentioned_user_id in
    select em.user_id
    from public.extract_mentions(v_combined_text) em
    join public.profiles p on p.id = em.user_id
    where em.user_id <> new.created_by
      and p.org_id = new.org_id
  loop
    perform public.create_notification(
      v_mentioned_user_id,
      'mention',
      'You were mentioned',
      v_creator_name || ' mentioned you in the announcement "' || new.title || '".',
      jsonb_build_object(
        'announcement_id', new.id::text,
        'url', '/announcements/' || new.id::text
      )
    );
  end loop;

  return new;
end;
$$;

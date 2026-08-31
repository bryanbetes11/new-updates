-- Treat the synthetic "All Members" role as an attendance invitation in
-- assignment notifications. Role-specific assignments keep their existing
-- serving language.

create or replace function public.on_event_assignment_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event record;
  v_role_name text;
  v_date_str text;
  v_relative_date text;
  v_song_leader_name text;
  v_body text;
  v_title text;
  v_linked_event record;
begin
  select * into v_event from public.events where id = new.event_id;
  select name into v_role_name from public.roles where id = new.role_id;

  v_date_str := to_char(v_event.event_date, 'FMMonth FMDD, YYYY');
  v_relative_date := public.get_relative_date_text(v_event.event_date);

  if v_event.song_leader_id is not null then
    select public.get_name_prefix(gender) || first_name || ' ' || last_name
    into v_song_leader_name
    from public.profiles where id = v_event.song_leader_id;
  elsif v_event.linked_event_id is not null then
    select * into v_linked_event from public.events where id = v_event.linked_event_id;
    if v_linked_event.song_leader_id is not null then
      select public.get_name_prefix(gender) || first_name || ' ' || last_name
      into v_song_leader_name
      from public.profiles where id = v_linked_event.song_leader_id;
    end if;
  end if;

  if lower(coalesce(v_role_name, '')) = 'all members' then
    v_title := 'Event invitation';
    v_body := 'You are invited to ' || v_event.title || ' on ' || v_date_str || v_relative_date || '. Please let the organizers know whether you can attend.';
  else
    v_title := 'New Assignment';
    if v_event.event_type = 'Rehearsal' and v_event.linked_event_id is not null then
      v_body := 'You have been assigned as ' || v_role_name || ' for Sunday Service Rehearsal';
      if v_song_leader_name is not null then
        v_body := v_body || '. Song Leader is ' || v_song_leader_name;
      end if;
      v_body := v_body || ' on ' || v_date_str || v_relative_date || '.';
    else
      v_body := 'You have been assigned as ' || v_role_name || ' for ' || v_event.title;
      if v_song_leader_name is not null then
        v_body := v_body || ' with Song Leader ' || v_song_leader_name;
      end if;
      v_body := v_body || ' on ' || v_date_str || v_relative_date || '.';
    end if;
  end if;

  perform public.create_notification(
    new.user_id,
    'assignment',
    v_title,
    v_body,
    jsonb_build_object(
      'event_id', new.event_id::text,
      'assignment_id', new.id::text,
      'response_kind', case when lower(coalesce(v_role_name, '')) = 'all members' then 'attendance' else 'assignment' end,
      'url', '/events/' || new.event_id::text
    )
  );
  return new;
end;
$$;

create or replace function public.on_assignment_status_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event record;
  v_user_name text;
  v_status_text text;
  v_date_str text;
  v_relative_date text;
  v_event_display text;
  v_role_name text;
  v_title text;
  v_body text;
begin
  if old.status = new.status then return new; end if;

  select * into v_event from public.events where id = new.event_id;
  select first_name || ' ' || last_name into v_user_name from public.profiles where id = new.user_id;
  select name into v_role_name from public.roles where id = new.role_id;

  if new.status = 'confirmed' then
    v_status_text := 'confirmed';
  elsif new.status = 'declined' then
    v_status_text := 'declined';
  else
    return new;
  end if;

  v_date_str := to_char(v_event.event_date, 'FMMonth FMDD, YYYY');
  v_relative_date := public.get_relative_date_text(v_event.event_date);
  v_event_display := case
    when v_event.event_type = 'Rehearsal' and v_event.linked_event_id is not null then 'Sunday Service Rehearsal'
    else v_event.title
  end;

  if lower(coalesce(v_role_name, '')) = 'all members' then
    v_title := case when new.status = 'confirmed' then 'Invitation accepted' else 'Invitation declined' end;
    v_body := v_user_name || case when new.status = 'confirmed' then ' is attending ' else ' cannot attend ' end
      || v_event_display || ' on ' || v_date_str || v_relative_date || '.';
  else
    v_title := 'Assignment ' || initcap(v_status_text);
    v_body := v_user_name || ' has ' || v_status_text || ' their assignment for ' || v_event_display || ' on ' || v_date_str || v_relative_date || '.';
  end if;

  perform public.create_notification(
    v_event.created_by,
    'assignment_response',
    v_title,
    v_body,
    jsonb_build_object(
      'event_id', new.event_id::text,
      'assignment_id', new.id::text,
      'response_kind', case when lower(coalesce(v_role_name, '')) = 'all members' then 'attendance' else 'assignment' end,
      'url', '/events/' || new.event_id::text
    )
  );
  return new;
end;
$$;

create or replace function public.remind_pending_event_assignments(
  p_event_id uuid,
  p_dry_run boolean default false
)
returns table (pending_user_count integer, notifications_sent integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requester_id uuid := auth.uid();
  v_org_id uuid;
  v_event_title text;
  v_event_date date;
  v_pending_user_count integer := 0;
  v_notifications_sent integer := 0;
  v_inserted integer := 0;
  v_recipient record;
  v_dedupe_key text;
begin
  if v_requester_id is null then raise exception 'Authentication required' using errcode = '28000'; end if;

  select event.org_id, event.title, event.event_date
  into v_org_id, v_event_title, v_event_date
  from public.events event
  where event.id = p_event_id and event.org_id = public.auth_org_id();

  if not found then raise exception 'Event not found in your organization' using errcode = 'P0002'; end if;
  if not (
    public.auth_is_org_admin() or public.is_platform_owner() or exists (
      select 1 from public.user_roles user_role
      join public.roles role on role.id = user_role.role_id
      where user_role.user_id = v_requester_id and user_role.org_id = v_org_id and lower(role.name) = 'admin'
    )
  ) then
    raise exception 'Only an administrator can send assignment reminders' using errcode = '42501';
  end if;

  select count(distinct assignment.user_id)::integer into v_pending_user_count
  from public.event_assignments assignment
  where assignment.event_id = p_event_id and assignment.org_id = v_org_id and assignment.status = 'pending';

  if p_dry_run or v_pending_user_count = 0 then return query select v_pending_user_count, 0; return; end if;

  for v_recipient in
    select assignment.user_id, count(*)::integer as assignment_count,
      bool_and(lower(coalesce(role.name, '')) = 'all members') as attendance_only
    from public.event_assignments assignment
    join public.roles role on role.id = assignment.role_id
    where assignment.event_id = p_event_id and assignment.org_id = v_org_id and assignment.status = 'pending'
    group by assignment.user_id
  loop
    v_dedupe_key := concat('manual-assignment-confirmation:', p_event_id::text, ':', v_recipient.user_id::text, ':', to_char(date_trunc('hour', now()), 'YYYYMMDDHH24'));
    insert into public.notifications (user_id, org_id, type, title, body, data, dedupe_key)
    values (
      v_recipient.user_id,
      v_org_id,
      'assignment_confirmation_reminder',
      case when v_recipient.attendance_only then 'Event invitation reminder' else 'Assignment confirmation needed' end,
      case
        when v_recipient.attendance_only then concat('Please let the organizers know whether you can attend ', v_event_title, ' on ', to_char(v_event_date, 'FMMonth FMDD, YYYY'), '.')
        when v_recipient.assignment_count = 1 then concat('Please respond to your assignment for ', v_event_title, ' on ', to_char(v_event_date, 'FMMonth FMDD, YYYY'), '.')
        else concat('Please respond to your ', v_recipient.assignment_count, ' assignments for ', v_event_title, ' on ', to_char(v_event_date, 'FMMonth FMDD, YYYY'), '.')
      end,
      jsonb_build_object(
        'event_id', p_event_id::text,
        'event_title', v_event_title,
        'event_date', to_char(v_event_date, 'YYYY-MM-DD'),
        'assignment_count', v_recipient.assignment_count,
        'response_kind', case when v_recipient.attendance_only then 'attendance' else 'assignment' end,
        'url', concat('/events/', p_event_id::text),
        'dedupe_key', v_dedupe_key
      ),
      v_dedupe_key
    ) on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
    get diagnostics v_inserted = row_count;
    v_notifications_sent := v_notifications_sent + v_inserted;
  end loop;

  return query select v_pending_user_count, v_notifications_sent;
end;
$$;

revoke all on function public.remind_pending_event_assignments(uuid, boolean) from public, anon;
grant execute on function public.remind_pending_event_assignments(uuid, boolean) to authenticated;

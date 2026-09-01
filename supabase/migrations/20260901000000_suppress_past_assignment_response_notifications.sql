-- Historical confirmations remain useful for attendance records, but should
-- not notify organizers long after the event has finished.
create or replace function public.on_assignment_status_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event record;
  v_main_event record;
  v_user_name text;
  v_status_text text;
  v_date_str text;
  v_relative_date text;
  v_role_name text;
  v_title text;
  v_body text;
begin
  if old.status = new.status then return new; end if;

  -- The paired update is an implementation detail. The member's original
  -- response produces the single user-facing notification.
  if current_setting('servesync.linked_confirmation_sync', true) = '1' then
    return new;
  end if;

  select * into v_event from public.events where id = new.event_id;
  v_main_event := v_event;

  if lower(coalesce(v_event.event_type, '')) in ('rehearsal', 'rehearsals')
     and v_event.linked_event_id is not null then
    select * into v_main_event
    from public.events
    where id = v_event.linked_event_id
      and org_id = v_event.org_id;

    if v_main_event.id is null then
      v_main_event := v_event;
    end if;
  end if;

  if v_main_event.event_date < (now() at time zone 'Asia/Manila')::date then
    return new;
  end if;

  select first_name || ' ' || last_name into v_user_name
  from public.profiles where id = new.user_id;
  select name into v_role_name from public.roles where id = new.role_id;

  if new.status = 'confirmed' then
    v_status_text := 'confirmed';
  elsif new.status = 'declined' then
    v_status_text := 'declined';
  else
    return new;
  end if;

  v_date_str := to_char(v_main_event.event_date, 'FMMonth FMDD, YYYY');
  v_relative_date := public.get_relative_date_text(v_main_event.event_date);

  if lower(coalesce(v_role_name, '')) = 'all members' then
    v_title := case when new.status = 'confirmed' then 'Invitation accepted' else 'Invitation declined' end;
    v_body := v_user_name || case when new.status = 'confirmed' then ' is attending ' else ' cannot attend ' end
      || v_main_event.title || ' on ' || v_date_str || v_relative_date || '.';
  else
    v_title := 'Assignment ' || initcap(v_status_text);
    v_body := v_user_name || ' has ' || v_status_text || ' their assignment for '
      || v_main_event.title || ' on ' || v_date_str || v_relative_date || '.';
  end if;

  perform public.create_notification(
    v_main_event.created_by,
    'assignment_response',
    v_title,
    v_body,
    jsonb_build_object(
      'event_id', v_main_event.id::text,
      'assignment_id', new.id::text,
      'response_kind', case when lower(coalesce(v_role_name, '')) = 'all members' then 'attendance' else 'assignment' end,
      'url', '/events/' || v_main_event.id::text
    )
  );
  return new;
end;
$$;

revoke all on function public.on_assignment_status_changed()
  from public, anon, authenticated;

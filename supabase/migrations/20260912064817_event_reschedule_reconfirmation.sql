-- The existing event UPDATE policies authorize schedule edits. Keeping the reset
-- in the existing private trigger makes edits and calendar moves atomic too.
create or replace function private.notify_event_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient_id uuid;
  v_rescheduled boolean := row(old.event_date, old.start_time, old.end_time)
    is distinct from row(new.event_date, new.start_time, new.end_time);
begin
  if row(old.title, old.event_date, old.start_time, old.end_time, old.event_type)
    is not distinct from row(new.title, new.event_date, new.start_time, new.end_time, new.event_type) then
    return new;
  end if;

  if v_rescheduled then
    update public.event_assignments
    set status = 'pending', confirmed_at = null, decline_reason = null, updated_at = now()
    where event_id = new.id and org_id = new.org_id;
  end if;

  for v_recipient_id in
    select distinct assignment.user_id
    from public.event_assignments assignment
    join public.profiles profile on profile.id = assignment.user_id and profile.org_id = new.org_id
    where assignment.event_id = new.id and assignment.org_id = new.org_id
      and (v_rescheduled or assignment.user_id <> coalesce(auth.uid(), new.created_by))
  loop
    perform public.create_notification(
      v_recipient_id,
      'event_updated',
      case when v_rescheduled then 'Event rescheduled — confirm availability' else 'Event Updated' end,
      case when v_rescheduled then
        new.title || ' has been rescheduled from ' || to_char(old.event_date, 'FMMonth FMDD, YYYY')
        || coalesce(' at ' || to_char(old.start_time, 'FMHH12:MI AM'), '')
        || coalesce(' – ' || to_char(old.end_time, 'FMHH12:MI AM'), '')
        || ' to ' || to_char(new.event_date, 'FMMonth FMDD, YYYY')
        || coalesce(' at ' || to_char(new.start_time, 'FMHH12:MI AM'), '')
        || coalesce(' – ' || to_char(new.end_time, 'FMHH12:MI AM'), '')
        || '. Please confirm your availability again.'
      else new.title || ' has updated schedule details for ' || to_char(new.event_date, 'FMMonth FMDD, YYYY') || '.' end,
      jsonb_build_object(
        'event_id', new.id::text, 'event_title', new.title,
        'event_date', to_char(new.event_date, 'FMMonth FMDD, YYYY'),
        'previous_event_date', old.event_date, 'previous_start_time', old.start_time,
        'previous_end_time', old.end_time, 'start_time', new.start_time, 'end_time', new.end_time,
        'requires_reconfirmation', v_rescheduled,
        'url', '/events/' || new.id::text
      )
    );
  end loop;
  return new;
end;
$$;

revoke all on function private.notify_event_change() from public, anon, authenticated;

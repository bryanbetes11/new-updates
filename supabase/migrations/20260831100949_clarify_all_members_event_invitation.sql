-- "All Members" represents an event invitation, not a serving-role assignment.
-- Update the already-deployed notification functions without changing their
-- authorization, trigger bindings, or delivery behavior.
do $$
declare
  v_function regprocedure;
  v_definition text;
begin
  foreach v_function in array array[
    'public.on_event_assignment_created()'::regprocedure,
    'public.on_assignment_status_changed()'::regprocedure,
    'public.remind_pending_event_assignments(uuid,boolean)'::regprocedure
  ] loop
    select pg_get_functiondef(v_function) into v_definition;

    v_definition := replace(v_definition, 'Attendance response needed', 'Event invitation');
    v_definition := replace(v_definition, 'You are expected to attend ', 'You are invited to ');
    v_definition := replace(v_definition, 'Attendance confirmed', 'Invitation accepted');
    v_definition := replace(v_definition, 'Unable to attend', 'Invitation declined');

    -- Reminder notifications should be clearly distinguishable from the
    -- original invitation notification.
    if v_function = 'public.remind_pending_event_assignments(uuid,boolean)'::regprocedure then
      v_definition := replace(v_definition, '''Event invitation''', '''Event invitation reminder''');
    end if;

    execute v_definition;
  end loop;
end;
$$;

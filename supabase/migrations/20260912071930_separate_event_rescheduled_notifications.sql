-- Preserve the existing catalog, adding the new rule for future organizations.
do $migration$
declare
  definition text := pg_get_functiondef('private.default_notification_rules()'::regprocedure);
  marker text := '(''event_updated'',';
begin
  if position('''event_rescheduled''' in definition) = 0 then
    if position(marker in definition) = 0 then raise exception 'Event updated default rule not found'; end if;
    execute replace(definition, marker,
      '(''event_rescheduled'', ''Event rescheduled'', ''events'', ''Assigned members are told the old and new schedule and asked to confirm availability again.'', array[''Assigned members''], true, true, true, true, ''high'', ''{}''::integer[]),' || chr(10) || marker);
  end if;
end;
$migration$;

insert into public.notification_rules (
  org_id, type, label, category, description, target_roles, enabled,
  required, in_app_enabled, push_enabled, priority, reminder_offsets
)
select organization.id, defaults.type, defaults.label, defaults.category,
  defaults.description, defaults.target_roles, defaults.enabled,
  defaults.required, defaults.in_app_enabled, defaults.push_enabled,
  defaults.priority, defaults.reminder_offsets
from public.organizations organization
cross join private.default_notification_rules() defaults
where defaults.type = 'event_rescheduled'
on conflict (org_id, type) do nothing;

-- Keep ordinary edits on event_updated; only date/time changes use the new rule.
do $migration$
declare
  definition text := pg_get_functiondef('private.notify_event_change()'::regprocedure);
begin
  if position('''event_rescheduled''' in definition) = 0 then
    if position('''event_updated'',' in definition) = 0 then raise exception 'Event notification producer not found'; end if;
    execute replace(definition, '''event_updated'',',
      'case when v_rescheduled then ''event_rescheduled'' else ''event_updated'' end,');
  end if;
end;
$migration$;

-- Keep attempting during daytime hours. The dedupe key still guarantees only
-- one reminder per follow-up and reminder stage, while allowing recovery if an
-- earlier cron run was delayed.
create or replace function private.create_observation_follow_up_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_created integer := 0;
begin
  with active_follow_ups as (
    select
      observation.id,
      observation.org_id,
      observation.event_id,
      observation.assigned_to,
      observation.category,
      observation.due_date,
      event.title as event_title,
      (now() at time zone coalesce(settings.default_timezone, 'Asia/Manila'))::date as local_date,
      extract(hour from now() at time zone coalesce(settings.default_timezone, 'Asia/Manila'))::integer as local_hour
    from public.post_event_observations observation
    join public.events event on event.id = observation.event_id
    left join public.notification_system_settings settings on settings.org_id = observation.org_id
    where observation.assigned_to is not null
      and observation.due_date is not null
      and observation.status <> 'resolved'
  ), reminder_rows as (
    select
      follow_up.*,
      case
        when follow_up.due_date = follow_up.local_date + 1 then 'due_soon'
        when follow_up.due_date = follow_up.local_date then 'due_today'
        else 'overdue'
      end as reminder_kind
    from active_follow_ups follow_up
    where follow_up.local_hour between 8 and 18
      and follow_up.due_date <= follow_up.local_date + 1
  ), inserted as (
    insert into public.notifications (user_id, org_id, type, title, body, data)
    select
      reminder.assigned_to,
      reminder.org_id,
      'post_event_observation_due',
      case reminder.reminder_kind
        when 'due_soon' then 'Observation follow-up due tomorrow'
        when 'due_today' then 'Observation follow-up due today'
        else 'Observation follow-up overdue'
      end,
      'Your ' || initcap(replace(reminder.category, '_', ' ')) || ' observation for ' ||
        coalesce(reminder.event_title, 'an event') ||
        case reminder.reminder_kind
          when 'due_soon' then ' is due tomorrow.'
          when 'due_today' then ' is due today.'
          else ' was due ' || to_char(reminder.due_date, 'Mon DD, YYYY') || '.'
        end || ' Update the status when the work is complete.',
      jsonb_build_object(
        'event_id', reminder.event_id::text,
        'observation_id', reminder.id::text,
        'observation_category', reminder.category,
        'due_date', reminder.due_date::text,
        'reminder_kind', reminder.reminder_kind,
        'url', '/events/' || reminder.event_id::text,
        'dedupe_key', case reminder.reminder_kind
          when 'overdue' then 'observation-overdue:' || reminder.id::text || ':' || reminder.local_date::text
          else 'observation-' || reminder.reminder_kind || ':' || reminder.id::text || ':' || reminder.due_date::text
        end
      )
    from reminder_rows reminder
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing
    returning 1
  )
  select count(*) into v_created from inserted;

  return v_created;
end;
$$;

revoke all on function private.create_observation_follow_up_reminders()
  from public, anon, authenticated;

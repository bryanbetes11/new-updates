alter table public.post_event_observations
  add column assigned_to uuid,
  add column due_date date,
  add constraint post_event_observations_assigned_to_fkey
    foreign key (assigned_to) references public.profiles(id) on delete restrict,
  add constraint post_event_observations_follow_up_pair_check
    check ((assigned_to is null) = (due_date is null));

create index post_event_observations_assigned_due_idx
  on public.post_event_observations (assigned_to, due_date)
  where assigned_to is not null and status <> 'resolved';

create or replace function private.validate_post_event_observation_follow_up()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_assignee_org_id uuid;
  v_can_manage boolean := false;
begin
  if (new.assigned_to is null) <> (new.due_date is null) then
    raise exception using
      errcode = '23514',
      message = 'Choose both a follow-up owner and due date, or leave both blank.';
  end if;

  if new.assigned_to is not null then
    select profile.org_id into v_assignee_org_id
    from public.profiles profile
    where profile.id = new.assigned_to;

    if v_assignee_org_id is distinct from new.org_id then
      raise exception using
        errcode = '23514',
        message = 'The follow-up owner must belong to the same organization.';
    end if;
  end if;

  if v_actor_id is not null then
    v_can_manage := coalesce(public.auth_is_org_admin(), false) or coalesce(public.auth_is_org_leader(), false);
  end if;

  if (
    tg_op = 'INSERT' and new.assigned_to is not null
  ) or (
    tg_op = 'UPDATE'
    and (
      new.assigned_to is distinct from old.assigned_to
      or new.due_date is distinct from old.due_date
    )
  ) then
    if v_actor_id is not null and not v_can_manage then
      raise exception using
        errcode = '42501',
        message = 'Only leadership can assign an observation owner and due date.';
    end if;
  end if;

  if tg_op = 'UPDATE'
     and v_actor_id = old.assigned_to
     and v_actor_id is distinct from old.author_id
     and not v_can_manage
     and (
       new.org_id is distinct from old.org_id
       or new.event_id is distinct from old.event_id
       or new.author_id is distinct from old.author_id
       or new.category is distinct from old.category
       or new.observation is distinct from old.observation
       or new.assigned_to is distinct from old.assigned_to
       or new.due_date is distinct from old.due_date
     ) then
    raise exception using
      errcode = '42501',
      message = 'The assigned owner can update the status, but only leadership can edit the follow-up details.';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_post_event_observation_follow_up()
  from public, anon, authenticated;

create trigger trg_post_event_observations_validate_follow_up
before insert or update on public.post_event_observations
for each row execute function private.validate_post_event_observation_follow_up();

drop policy if exists "Authors and leaders can update post-event observations"
  on public.post_event_observations;
create policy "Authors owners and leaders can update post-event observations"
  on public.post_event_observations for update
  to authenticated
  using (
    org_id = public.auth_org_id()
    and (
      (author_id = (select auth.uid()) and status = 'open')
      or assigned_to = (select auth.uid())
      or public.auth_is_org_admin()
      or public.auth_is_org_leader()
    )
  )
  with check (
    org_id = public.auth_org_id()
    and (
      (
        author_id = (select auth.uid())
        and status = 'open'
        and resolved_at is null
        and resolved_by is null
      )
      or assigned_to = (select auth.uid())
      or public.auth_is_org_admin()
      or public.auth_is_org_leader()
    )
  );

insert into public.notification_rules (
  org_id, type, label, category, description, target_roles, enabled,
  required, in_app_enabled, push_enabled, priority, reminder_offsets
)
select organization.id, rule.*
from public.organizations organization
cross join (values
  (
    'post_event_observation_assigned', 'Observation follow-up assigned', 'events',
    'The selected owner is told when an observation is assigned to them.',
    array['Assigned owner']::text[], true, true, true, true, 'high', '{}'::integer[]
  ),
  (
    'post_event_observation_due', 'Observation follow-up reminder', 'events',
    'The owner is reminded before, on, and after the due date until the observation is resolved.',
    array['Assigned owner']::text[], true, true, true, true, 'high', '{}'::integer[]
  )
) as rule(
  type, label, category, description, target_roles, enabled,
  required, in_app_enabled, push_enabled, priority, reminder_offsets
)
on conflict (org_id, type) do update set
  label = excluded.label,
  category = excluded.category,
  description = excluded.description,
  target_roles = excluded.target_roles,
  enabled = excluded.enabled,
  required = excluded.required,
  in_app_enabled = excluded.in_app_enabled,
  push_enabled = excluded.push_enabled,
  priority = excluded.priority;

create or replace function private.ensure_observation_follow_up_notification_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notification_rules (
    org_id, type, label, category, description, target_roles, enabled,
    required, in_app_enabled, push_enabled, priority, reminder_offsets
  ) values
    (
      new.id, 'post_event_observation_assigned', 'Observation follow-up assigned', 'events',
      'The selected owner is told when an observation is assigned to them.',
      array['Assigned owner'], true, true, true, true, 'high', '{}'
    ),
    (
      new.id, 'post_event_observation_due', 'Observation follow-up reminder', 'events',
      'The owner is reminded before, on, and after the due date until the observation is resolved.',
      array['Assigned owner'], true, true, true, true, 'high', '{}'
    )
  on conflict (org_id, type) do nothing;
  return new;
end;
$$;

revoke all on function private.ensure_observation_follow_up_notification_rules()
  from public, anon, authenticated;

create trigger organizations_ensure_observation_follow_up_notification_rules
after insert on public.organizations
for each row execute function private.ensure_observation_follow_up_notification_rules();

create or replace function private.notify_post_event_observation_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_title text;
  v_category text;
begin
  if new.assigned_to is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.assigned_to is not distinct from old.assigned_to
     and new.due_date is not distinct from old.due_date then
    return new;
  end if;

  select event.title into v_event_title
  from public.events event
  where event.id = new.event_id;

  v_category := initcap(replace(new.category, '_', ' '));

  perform public.create_notification(
    new.assigned_to,
    'post_event_observation_assigned',
    'Observation follow-up assigned to you',
    'You are responsible for the ' || v_category || ' observation for ' ||
      coalesce(v_event_title, 'an event') || '. Due ' || to_char(new.due_date, 'Mon DD, YYYY') || '.',
    jsonb_build_object(
      'event_id', new.event_id::text,
      'observation_id', new.id::text,
      'observation_category', new.category,
      'due_date', new.due_date::text,
      'url', '/events/' || new.event_id::text,
      'dedupe_key', 'observation-assigned:' || new.id::text || ':' ||
        new.assigned_to::text || ':' || new.due_date::text || ':' || txid_current()::text
    )
  );

  return new;
end;
$$;

revoke all on function private.notify_post_event_observation_assignment()
  from public, anon, authenticated;

create trigger post_event_observations_assignment_notification
after insert or update of assigned_to, due_date on public.post_event_observations
for each row execute function private.notify_post_event_observation_assignment();

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

do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'servesync-observation-follow-up-reminders';

  perform cron.schedule(
    'servesync-observation-follow-up-reminders',
    '15 * * * *',
    'select private.create_observation_follow_up_reminders();'
  );
end;
$$;

comment on column public.post_event_observations.assigned_to is
  'Team member responsible for completing this observation follow-up.';
comment on column public.post_event_observations.due_date is
  'Local calendar date when this observation follow-up is due.';

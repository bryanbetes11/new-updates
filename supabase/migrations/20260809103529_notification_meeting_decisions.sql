-- Apply the notification decisions agreed for the August 9 team meeting:
--   * setlist submissions go to leadership; approvals/changes go to the team
--   * post-event observation activity is shared with every member
--   * automatic absences notify the affected member
--   * Revamp Session and Youth Recharge creation sends push alerts
--   * admins can inspect push readiness without seeing subscription secrets

-- ---- Notification catalog -------------------------------------------------

insert into public.notification_rules (
  org_id, type, label, category, description, target_roles, enabled,
  required, in_app_enabled, push_enabled, priority, reminder_offsets
)
select organization.id, rule.*
from public.organizations organization
cross join (values
  (
    'featured_event_created', 'Featured event scheduled', 'events',
    'Members receive an in-app and push alert when Revamp Session or Youth Recharge is scheduled.',
    array['Members']::text[], true, false, true, true, 'high', '{}'::integer[]
  ),
  (
    'post_event_observation_added', 'New post-event observation', 'events',
    'Members are told when a teammate records a post-event observation.',
    array['Members']::text[], true, false, true, true, 'normal', '{}'::integer[]
  ),
  (
    'post_event_observation_status_changed', 'Observation status changed', 'events',
    'Members are told when a post-event observation starts monitoring or is resolved.',
    array['Members']::text[], true, false, true, true, 'normal', '{}'::integer[]
  ),
  (
    'attendance_auto_absent', 'Attendance recorded as absent', 'attendance',
    'A member is told when missing attendance is automatically recorded as absent.',
    array['Member']::text[], true, true, true, true, 'urgent', '{}'::integer[]
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
  required = excluded.required,
  in_app_enabled = excluded.in_app_enabled,
  push_enabled = excluded.push_enabled,
  priority = excluded.priority,
  reminder_offsets = excluded.reminder_offsets;

update public.notification_rules
set
  description = 'Assigned team members are told when a setlist is approved for use.',
  target_roles = array['Assigned members'],
  required = true,
  in_app_enabled = true,
  push_enabled = true,
  priority = 'high'
where type = 'setlist_approved';

update public.notification_rules
set
  description = 'The full assigned team is told when an approved setlist changes and needs re-approval.',
  target_roles = array['Assigned members'],
  in_app_enabled = true,
  push_enabled = true
where type = 'setlist_changed';

update public.notification_rules
set
  description = 'Leadership is told when a setlist is submitted for review.',
  target_roles = array['Leadership'],
  required = true,
  in_app_enabled = true,
  push_enabled = true
where type = 'setlist_submitted';

update public.notification_rules
set target_roles = array['Admin', 'Selected member']
where type = 'push_test';

create or replace function private.seed_meeting_notification_rules()
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
      new.id, 'featured_event_created', 'Featured event scheduled', 'events',
      'Members receive an in-app and push alert when Revamp Session or Youth Recharge is scheduled.',
      array['Members'], true, false, true, true, 'high', '{}'
    ),
    (
      new.id, 'post_event_observation_added', 'New post-event observation', 'events',
      'Members are told when a teammate records a post-event observation.',
      array['Members'], true, false, true, true, 'normal', '{}'
    ),
    (
      new.id, 'post_event_observation_status_changed', 'Observation status changed', 'events',
      'Members are told when a post-event observation starts monitoring or is resolved.',
      array['Members'], true, false, true, true, 'normal', '{}'
    ),
    (
      new.id, 'attendance_auto_absent', 'Attendance recorded as absent', 'attendance',
      'A member is told when missing attendance is automatically recorded as absent.',
      array['Member'], true, true, true, true, 'urgent', '{}'
    )
  on conflict (org_id, type) do nothing;
  return new;
end;
$$;

drop trigger if exists organizations_seed_meeting_notification_rules on public.organizations;
create trigger organizations_seed_meeting_notification_rules
after insert on public.organizations
for each row execute function private.seed_meeting_notification_rules();

-- ---- Event creation: push only featured event types -----------------------

create or replace function private.notify_event_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text := case
    when new.event_type in ('Revamp Session', 'Youth Recharge')
      then 'featured_event_created'
    else 'event_created'
  end;
begin
  perform public.notify_all_except(
    new.created_by,
    v_type,
    case when v_type = 'featured_event_created'
      then new.event_type || ' scheduled'
      else 'New Event'
    end,
    new.title || ' was added for ' || to_char(new.event_date, 'FMMonth FMDD, YYYY') || '.',
    jsonb_build_object(
      'event_id', new.id::text,
      'event_title', new.title,
      'event_type', new.event_type,
      'event_date', to_char(new.event_date, 'FMMonth FMDD, YYYY'),
      'url', '/events/' || new.id::text,
      'dedupe_key', 'event-created:' || new.id::text
    )
  );
  return new;
end;
$$;

-- ---- Setlist audiences and duplicate prevention --------------------------

create or replace function public.on_setlist_status_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event record;
  v_recipient_id uuid;
  v_actor_id uuid := auth.uid();
  v_date_text text;
  v_event_display text;
  v_review_note text;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  select event.id, event.org_id, event.title, event.event_date, event.event_type
  into v_event
  from public.events event
  where event.id = new.event_id;

  if not found then return new; end if;

  v_date_text := to_char(v_event.event_date, 'FMMonth FMDD, YYYY');
  v_event_display := coalesce(nullif(btrim(v_event.title), ''), v_event.event_type, 'event');
  v_review_note := coalesce(
    nullif(btrim(new.review_note), ''),
    nullif(btrim(new.approval_notes), ''),
    'No reason provided.'
  );

  if new.status = 'pending_review' then
    -- Only leadership reviews submissions. Include organization admins even
    -- when they do not currently hold a leadership role.
    for v_recipient_id in
      select distinct recipient_id
      from (
        select membership.user_id as recipient_id
        from public.user_roles membership
        join public.roles role on role.id = membership.role_id
        where membership.org_id = v_event.org_id
          and role.is_leadership = true
        union
        select profile.id
        from public.profiles profile
        where profile.org_id = v_event.org_id
          and profile.is_org_admin = true
      ) leadership
      where recipient_id <> coalesce(v_actor_id, new.created_by)
    loop
      perform public.create_notification(
        v_recipient_id,
        'setlist_submitted',
        'Setlist Submitted for Review',
        'A setlist for ' || v_event_display || ' on ' || v_date_text || ' is ready for review.',
        jsonb_build_object(
          'event_id', new.event_id::text,
          'setlist_id', new.id::text,
          'url', '/events/' || new.event_id::text,
          'dedupe_key', 'setlist-submitted:' || new.id::text || ':' || txid_current()::text
        )
      );
    end loop;

    if old.status = 'approved' then
      for v_recipient_id in
        select distinct assignment.user_id
        from public.event_assignments assignment
        where assignment.event_id = new.event_id
          and assignment.user_id <> coalesce(v_actor_id, new.created_by)
      loop
        perform public.create_notification(
          v_recipient_id,
          'setlist_changed',
          'Approved Setlist Updated',
          'The approved setlist for ' || v_event_display || ' was updated and is being reviewed again.',
          jsonb_build_object(
            'event_id', new.event_id::text,
            'setlist_id', new.id::text,
            'url', '/events/' || new.event_id::text,
            'dedupe_key', 'setlist-changed:' || new.id::text || ':' || txid_current()::text
          )
        );
      end loop;
    end if;

  elsif new.status = 'approved' then
    -- The approved set is now usable by the entire assigned team.
    for v_recipient_id in
      select distinct assignment.user_id
      from public.event_assignments assignment
      where assignment.event_id = new.event_id
        and assignment.user_id <> v_actor_id
    loop
      perform public.create_notification(
        v_recipient_id,
        'setlist_approved',
        'Setlist Approved',
        'The setlist for ' || v_event_display || ' on ' || v_date_text || ' is approved and ready to use.',
        jsonb_build_object(
          'event_id', new.event_id::text,
          'setlist_id', new.id::text,
          'url', '/events/' || new.event_id::text,
          'dedupe_key', 'setlist-approved:' || new.id::text || ':' || txid_current()::text
        )
      );
    end loop;

  elsif new.status in ('revision_requested', 'rejected')
    and new.created_by <> coalesce(v_actor_id, '00000000-0000-0000-0000-000000000000'::uuid) then
    perform public.create_notification(
      new.created_by,
      case when new.status = 'rejected' then 'setlist_rejected' else 'setlist_revision' end,
      case when new.status = 'rejected' then 'Setlist Rejected' else 'Setlist Revision Requested' end,
      'The setlist for ' || v_event_display || ' on ' || v_date_text ||
        case when new.status = 'rejected' then ' was not approved. ' else ' needs revision. ' end ||
        'Reason: ' || v_review_note,
      jsonb_build_object(
        'event_id', new.event_id::text,
        'setlist_id', new.id::text,
        'review_notes', v_review_note,
        'url', '/events/' || new.event_id::text,
        'dedupe_key', new.status || ':' || new.id::text || ':' || txid_current()::text
      )
    );
  end if;

  return new;
end;
$$;

-- ---- Post-event observation activity -------------------------------------

create or replace function private.notify_post_event_observation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_title text;
  v_author_name text;
  v_recipient_id uuid;
  v_actor_id uuid;
  v_type text;
  v_title text;
  v_body text;
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;

  select event.title into v_event_title
  from public.events event
  where event.id = new.event_id;

  select coalesce(nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''), 'A team member')
  into v_author_name
  from public.profiles profile
  where profile.id = new.author_id;

  if tg_op = 'INSERT' then
    v_actor_id := new.author_id;
    v_type := 'post_event_observation_added';
    v_title := 'New post-event observation';
    v_body := v_author_name || ' added a ' || initcap(replace(new.category, '_', ' ')) ||
      ' observation for ' || coalesce(v_event_title, 'an event') || '.';
  else
    v_actor_id := coalesce(auth.uid(), new.resolved_by);
    v_type := 'post_event_observation_status_changed';
    v_title := case when new.status = 'resolved' then 'Observation resolved' else 'Observation being monitored' end;
    v_body := 'A ' || initcap(replace(new.category, '_', ' ')) || ' observation for ' ||
      coalesce(v_event_title, 'an event') || ' is now ' || initcap(new.status) || '.';
  end if;

  for v_recipient_id in
    select profile.id
    from public.profiles profile
    where profile.org_id = new.org_id
      and profile.id <> coalesce(v_actor_id, '00000000-0000-0000-0000-000000000000'::uuid)
  loop
    perform public.create_notification(
      v_recipient_id,
      v_type,
      v_title,
      v_body,
      jsonb_build_object(
        'event_id', new.event_id::text,
        'observation_id', new.id::text,
        'observation_category', new.category,
        'observation_status', new.status,
        'url', '/events/' || new.event_id::text,
        'dedupe_key', v_type || ':' || new.id::text || ':' || txid_current()::text
      )
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists post_event_observations_create_notifications
  on public.post_event_observations;
create trigger post_event_observations_create_notifications
after insert on public.post_event_observations
for each row execute function private.notify_post_event_observation_change();

drop trigger if exists post_event_observations_status_notifications
  on public.post_event_observations;
create trigger post_event_observations_status_notifications
after update of status on public.post_event_observations
for each row execute function private.notify_post_event_observation_change();

-- ---- Automatic absence accountability ------------------------------------

create or replace function private.notify_automatic_absence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event record;
begin
  if new.status <> 'absent'
    or coalesce(new.notes, '') not ilike 'Auto-marked absent%' then
    return new;
  end if;

  select event.title, event.event_date
  into v_event
  from public.events event
  where event.id = new.event_id;

  perform public.create_notification(
    new.user_id,
    'attendance_auto_absent',
    'Attendance recorded as absent',
    'Your attendance for ' || coalesce(v_event.title, 'the event') || ' on ' ||
      to_char(v_event.event_date, 'FMMonth FMDD, YYYY') ||
      ' was recorded as absent because no attendance was submitted. Contact leadership if this needs correction.',
    jsonb_build_object(
      'event_id', new.event_id::text,
      'attendance_id', new.id::text,
      'url', '/events/' || new.event_id::text,
      'dedupe_key', 'attendance-auto-absent:' || new.event_id::text || ':' || new.user_id::text
    )
  );

  return new;
end;
$$;

drop trigger if exists event_attendance_create_auto_absent_notifications
  on public.event_attendance;
create trigger event_attendance_create_auto_absent_notifications
after insert on public.event_attendance
for each row execute function private.notify_automatic_absence();

-- ---- Push-readiness administration ---------------------------------------

create or replace function public.get_org_push_readiness()
returns table (
  user_id uuid,
  first_name text,
  last_name text,
  email text,
  ministry_status text,
  is_onboarded boolean,
  subscription_count bigint,
  preference_enabled boolean,
  push_ready boolean,
  last_push_status text,
  last_push_sent_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
begin
  select profile.org_id
  into v_org_id
  from public.profiles profile
  where profile.id = auth.uid()
    and profile.is_org_admin = true;

  if v_org_id is null then
    raise exception 'Only organization admins can view push readiness'
      using errcode = '42501';
  end if;

  return query
  select
    profile.id,
    profile.first_name,
    profile.last_name,
    profile.email,
    profile.ministry_status,
    profile.is_onboarded,
    coalesce(subscription.subscription_count, 0),
    coalesce(preference.push_enabled, true),
    coalesce(subscription.subscription_count, 0) > 0
      and coalesce(preference.push_enabled, true),
    latest_push.push_status,
    latest_push.push_sent_at
  from public.profiles profile
  left join public.notification_preferences preference
    on preference.user_id = profile.id
   and preference.org_id = profile.org_id
  left join lateral (
    select count(*)::bigint as subscription_count
    from public.push_subscriptions subscription
    where subscription.user_id = profile.id
      and subscription.org_id = profile.org_id
  ) subscription on true
  left join lateral (
    select notification.push_status, notification.push_sent_at
    from public.notifications notification
    where notification.user_id = profile.id
      and notification.org_id = profile.org_id
      and coalesce((notification.delivery_channels ->> 'push')::boolean, false)
    order by notification.created_at desc
    limit 1
  ) latest_push on true
  where profile.org_id = v_org_id
  order by
    (profile.ministry_status = 'active') desc,
    profile.first_name,
    profile.last_name;
end;
$$;

create or replace function public.send_push_readiness_test(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_admin_name text;
  v_notification_id uuid;
begin
  select
    profile.org_id,
    coalesce(nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''), 'An administrator')
  into v_org_id, v_admin_name
  from public.profiles profile
  where profile.id = auth.uid()
    and profile.is_org_admin = true;

  if v_org_id is null then
    raise exception 'Only organization admins can send push tests'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles target
    where target.id = p_user_id
      and target.org_id = v_org_id
  ) then
    raise exception 'Member is not in your organization'
      using errcode = '42501';
  end if;

  insert into public.notifications (user_id, org_id, type, title, body, data)
  values (
    p_user_id,
    v_org_id,
    'push_test',
    'ServeSync notification test',
    v_admin_name || ' sent this test to confirm notification delivery on your device.',
    jsonb_build_object(
      'url', '/notifications',
      'dedupe_key', 'admin-push-test:' || gen_random_uuid()::text
    )
  )
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

revoke all on function private.seed_meeting_notification_rules()
  from public, anon, authenticated;
revoke all on function private.notify_event_created()
  from public, anon, authenticated;
revoke all on function public.on_setlist_status_changed()
  from public, anon, authenticated;
revoke all on function private.notify_post_event_observation_change()
  from public, anon, authenticated;
revoke all on function private.notify_automatic_absence()
  from public, anon, authenticated;
revoke all on function public.get_org_push_readiness()
  from public, anon;
revoke all on function public.send_push_readiness_test(uuid)
  from public, anon;
grant execute on function public.get_org_push_readiness() to authenticated;
grant execute on function public.send_push_readiness_test(uuid) to authenticated;

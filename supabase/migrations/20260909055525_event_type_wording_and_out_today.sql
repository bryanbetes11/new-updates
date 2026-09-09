-- Per-event-type copy inherits the existing rule and its tenant-scoped RLS.
alter table public.notification_rules
  add column event_type_templates jsonb not null default '{}'::jsonb
  constraint notification_event_templates_object check (jsonb_typeof(event_type_templates) = 'object');

-- Render both administrator-friendly placeholders (for example, [Event]) and
-- machine-style placeholders (for example, {{event_title}}). If a configured
-- template still cannot be fully rendered, the insert trigger below preserves
-- the notification producer's resolved copy instead of exposing placeholders.

create or replace function private.render_notification_template(
  p_template text,
  p_context jsonb
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_result text := p_template;
  v_context jsonb := coalesce(p_context, '{}'::jsonb);
  v_pair record;
  v_friendly_key text;
begin
  if p_template is null then
    return null;
  end if;

  -- Keep the friendly names used by the notification settings UI compatible
  -- with the more specific keys emitted by notification producers.
  if nullif(v_context ->> 'event', '') is null
    and nullif(v_context ->> 'event_title', '') is not null then
    v_context := jsonb_set(v_context, '{event}', to_jsonb(v_context ->> 'event_title'));
  end if;
  if nullif(v_context ->> 'date', '') is null
    and nullif(v_context ->> 'event_date', '') is not null then
    v_context := jsonb_set(v_context, '{date}', to_jsonb(v_context ->> 'event_date'));
  end if;
  if nullif(v_context ->> 'role', '') is null
    and nullif(v_context ->> 'role_name', '') is not null then
    v_context := jsonb_set(v_context, '{role}', to_jsonb(v_context ->> 'role_name'));
  end if;
  if nullif(v_context ->> 'review notes', '') is null
    and nullif(v_context ->> 'review_notes', '') is not null then
    v_context := jsonb_set(v_context, '{review notes}', to_jsonb(v_context ->> 'review_notes'));
  end if;

  for v_pair in
    select key, value
    from jsonb_each_text(v_context)
  loop
    v_friendly_key := initcap(replace(v_pair.key, '_', ' '));
    v_result := replace(v_result, '{{' || v_pair.key || '}}', v_pair.value);
    v_result := replace(v_result, '[' || v_pair.key || ']', v_pair.value);
    v_result := replace(v_result, '[' || replace(v_pair.key, '_', ' ') || ']', v_pair.value);
    v_result := replace(v_result, '[' || v_friendly_key || ']', v_pair.value);
    -- Sentence-case placeholders used in the editor, e.g. [Event type].
    v_result := replace(v_result, '[' || upper(left(replace(v_pair.key, '_', ' '), 1))
      || substr(replace(v_pair.key, '_', ' '), 2) || ']', v_pair.value);
  end loop;

  return v_result;
end;
$$;

create or replace function private.notification_template_has_placeholders(
  p_value text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_value ~ '(\[[^][]+\]|\{\{[^{}]+\}\})', false);
$$;

create or replace function private.configure_notification_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule public.notification_rules%rowtype;
  v_preference public.notification_preferences%rowtype;
  v_push_delivery_enabled boolean := true;
  v_in_app boolean;
  v_push boolean;
  v_org_id uuid;
  v_rendered_title text;
  v_rendered_body text;
  v_event public.events%rowtype;
  v_event_id uuid;
  v_event_type text;
  v_override jsonb;
begin
  if new.org_id is null then
    select profile.org_id into v_org_id
    from public.profiles profile
    where profile.id = new.user_id;
    new.org_id := v_org_id;
  end if;

  if new.org_id is null then
    return null;
  end if;

  insert into public.notification_rules (
    org_id, type, label, category, description
  )
  values (
    new.org_id,
    new.type,
    initcap(replace(new.type, '_', ' ')),
    'system',
    'Automatically discovered notification type.'
  )
  on conflict (org_id, type) do nothing;

  select * into v_rule
  from public.notification_rules rule
  where rule.org_id = new.org_id
    and rule.type = new.type;

  if not found or not v_rule.enabled then
    return null;
  end if;

  -- Resolve event context only inside the recipient's organization.
  begin
    v_event_id := nullif(new.data ->> 'event_id', '')::uuid;
  exception when invalid_text_representation then
    v_event_id := null;
  end;
  select * into v_event from public.events
    where id = v_event_id and org_id = new.org_id;
  if found then
    new.data := coalesce(new.data, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'event_type', v_event.event_type,
      'event_title', v_event.title,
      'event', case when lower(btrim(v_event.title)) = lower(btrim(v_event.event_type))
        then v_event.title else v_event.event_type || ' · ' || v_event.title end,
      'event_date', to_char(v_event.event_date, 'FMMonth DD, YYYY'),
      'start_time', to_char(v_event.start_time, 'FMHH12:MI AM')
    ));
  end if;
  v_event_type := nullif(new.data ->> 'event_type', '');
  v_override := v_rule.event_type_templates -> v_event_type;
  v_rule.template_title := coalesce(nullif(btrim(v_override ->> 'title'), ''), v_rule.template_title);
  v_rule.template_body := coalesce(nullif(btrim(v_override ->> 'body'), ''), v_rule.template_body);

  select * into v_preference
  from public.notification_preferences preference
  where preference.user_id = new.user_id
    and preference.org_id = new.org_id;

  if not v_rule.required
    and new.type = any(coalesce(v_preference.muted_types, '{}'::text[])) then
    return null;
  end if;

  select settings.push_delivery_enabled into v_push_delivery_enabled
  from public.notification_system_settings settings
  where settings.org_id = new.org_id;

  v_in_app := v_rule.required
    or (v_rule.in_app_enabled and coalesce(v_preference.in_app_enabled, true));
  v_push := v_rule.push_enabled
    and coalesce(v_preference.push_enabled, true)
    and coalesce(v_push_delivery_enabled, true);

  if not v_in_app and not v_push then
    return null;
  end if;

  new.category := v_rule.category;
  new.priority := v_rule.priority;
  new.required := v_rule.required;
  new.delivery_channels := jsonb_build_object(
    'in_app', v_in_app,
    'push', v_push
  );
  new.scheduled_for := coalesce(new.scheduled_for, now());
  new.push_status := case when v_push then 'pending' else 'not_requested' end;
  new.dedupe_key := coalesce(new.dedupe_key, nullif(new.data ->> 'dedupe_key', ''));

  if nullif(btrim(v_rule.template_title), '') is not null then
    v_rendered_title := private.render_notification_template(v_rule.template_title, new.data);
    if not private.notification_template_has_placeholders(v_rendered_title) then
      new.title := v_rendered_title;
    end if;
  end if;

  if nullif(btrim(v_rule.template_body), '') is not null then
    v_rendered_body := private.render_notification_template(v_rule.template_body, new.data);
    if not private.notification_template_has_placeholders(v_rendered_body) then
      new.body := v_rendered_body;
    end if;
  end if;

  -- Preserve producer copy/custom templates, but always identify the event type.
  if v_event_type is not null and position(lower(v_event_type) in lower(coalesce(new.body, ''))) = 0 then
    new.body := coalesce(new.body, '') || ' · ' || v_event_type;
  end if;
  return new;
end;
$$;

revoke all on function private.render_notification_template(text, jsonb)
  from public, anon, authenticated;
revoke all on function private.notification_template_has_placeholders(text)
  from public, anon, authenticated;
revoke all on function private.configure_notification_insert()
  from public, anon, authenticated;


-- Pure same-day predicate, shared by the digest query and isolated regression checks.
create or replace function private.is_out_on_date(
  p_status text, p_request_type text, p_leave_type text,
  p_single date, p_start date, p_end date, p_date date
) returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p_status = 'approved' and coalesce(p_request_type, 'leave') = 'leave'
    and case when p_leave_type = 'range' then p_date between p_start and p_end
      else p_single = p_date end, false);
$$;

-- Read-only source used by the scheduler. No reasons or review notes leave this query.
create or replace function private.out_today_digest(p_at timestamptz default now())
returns table (org_id uuid, local_date date, member_count bigint, event_names text, assigned_count bigint)
language sql stable security definer set search_path = '' as $$
  with org_days as (
    select s.org_id, (p_at at time zone s.default_timezone)::date as local_date
    from public.notification_system_settings s
    where (p_at at time zone s.default_timezone)::time >= time '06:00'
  ), out_members as (
    select distinct d.org_id, d.local_date, a.user_id
    from org_days d
    join public.user_availability a on a.org_id = d.org_id
    join public.profiles p on p.id = a.user_id and p.org_id = d.org_id
      and p.ministry_status = 'active' and p.is_onboarded
    where private.is_out_on_date(a.status, a.request_type, a.leave_type,
      a.unavailable_date, a.start_date, a.end_date, d.local_date)
  ), day_events as (
    select d.org_id, d.local_date, e.id,
      case when lower(btrim(e.title)) = lower(btrim(e.event_type)) then e.title
        else e.event_type || ' · ' || e.title end as label
    from org_days d join public.events e on e.org_id = d.org_id and e.event_date = d.local_date
    where coalesce(e.lifecycle_override, '') <> 'completed'
  )
  select o.org_id, o.local_date, count(distinct o.user_id),
    (select string_agg(distinct e.label, '; ' order by e.label) from day_events e
      where e.org_id = o.org_id and e.local_date = o.local_date),
    count(distinct o.user_id) filter (where exists (
      select 1 from public.event_assignments a join day_events e on e.id = a.event_id
      where a.user_id = o.user_id and a.org_id = o.org_id and e.org_id = o.org_id
        and e.local_date = o.local_date and a.status <> 'declined'
    ))
  from out_members o
  where exists (select 1 from day_events e where e.org_id = o.org_id and e.local_date = o.local_date)
  group by o.org_id, o.local_date;
$$;

create or replace function private.seed_out_today_rule()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notification_rules(org_id, type, label, category, description, target_roles)
  values (new.id, 'out_today', 'Out Today', 'members',
    'One daily availability summary for all active members on event days, from 6 AM in the church timezone.',
    array['All active members'])
  on conflict (org_id, type) do nothing;
  return new;
end;
$$;
create trigger organizations_seed_out_today_rule after insert on public.organizations
for each row execute function private.seed_out_today_rule();
insert into public.notification_rules(org_id, type, label, category, description, target_roles)
select id, 'out_today', 'Out Today', 'members',
  'One daily availability summary for all active members on event days, from 6 AM in the church timezone.',
  array['All active members'] from public.organizations
on conflict (org_id, type) do nothing;

-- Keep daily delivery history separate from the inbox: Clear all must not cause
-- another digest to be sent at the next hourly check.
create table private.out_today_deliveries (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  local_date date not null,
  primary key (org_id, user_id, local_date)
);
alter table private.out_today_deliveries enable row level security;
revoke all on private.out_today_deliveries from public, anon, authenticated;

create or replace function private.create_out_today_notifications()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_created integer;
begin
  with inserted as (
    insert into public.notifications(user_id, org_id, type, title, body, data, dedupe_key)
    select p.id, d.org_id, 'out_today', 'Out Today',
      d.member_count || case when d.member_count = 1 then ' member is' else ' members are' end
      || ' out today. ' || d.event_names || '. '
      || case when d.assigned_count > 0 then d.assigned_count || ' assigned member(s) affected. ' else '' end
      || 'Open to view availability and reasons.',
      jsonb_build_object('date', to_char(d.local_date, 'FMMonth DD, YYYY'),
        'count', d.member_count, 'event_names', d.event_names, 'availability_date', d.local_date,
        'assigned_count', d.assigned_count,
        'url', '/unavailable-members?date=' || d.local_date::text),
      'out_today:' || d.org_id::text || ':' || d.local_date::text
    from private.out_today_digest() d
    join public.profiles p on p.org_id = d.org_id and p.ministry_status = 'active' and p.is_onboarded
    -- Avoid re-running hooks for recipients already notified; the index handles races.
    where not exists (select 1 from public.notifications n where n.user_id = p.id
      and n.dedupe_key = 'out_today:' || d.org_id::text || ':' || d.local_date::text)
      and not exists (select 1 from private.out_today_deliveries delivered
        where delivered.org_id = d.org_id and delivered.user_id = p.id and delivered.local_date = d.local_date)
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing
    returning user_id, org_id, data
  ), recorded as (
    insert into private.out_today_deliveries(org_id, user_id, local_date)
    select org_id, user_id, (data ->> 'availability_date')::date from inserted
    on conflict do nothing
  ) select count(*) into v_created from inserted;
  return v_created;
end;
$$;

revoke all on function private.is_out_on_date(text,text,text,date,date,date,date) from public, anon, authenticated;
revoke all on function private.out_today_digest(timestamptz) from public, anon, authenticated;
revoke all on function private.seed_out_today_rule() from public, anon, authenticated;
revoke all on function private.create_out_today_notifications() from public, anon, authenticated;

-- Runs hourly for timezone support and same-day approvals; unique recipient/day keys
-- prevent repeats. Activation is part of deployment, never invoked by test scripts.
select cron.schedule('servesync-out-today', '5 * * * *',
  'select private.create_out_today_notifications();');

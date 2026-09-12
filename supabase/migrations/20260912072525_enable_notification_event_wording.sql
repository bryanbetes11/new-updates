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

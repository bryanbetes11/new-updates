-- Notification pipeline snapshot verified against the database on 2026-09-12.
-- Loaded only in isolated tests with an inert net.http_post adapter.
CREATE OR REPLACE FUNCTION private.configure_notification_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_rule public.notification_rules%rowtype;
  v_preference public.notification_preferences%rowtype;
  v_push_delivery_enabled boolean := true;
  v_in_app boolean;
  v_push boolean;
  v_org_id uuid;
  v_rendered_title text;
  v_rendered_body text;
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

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.render_notification_template(p_template text, p_context jsonb)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
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
  end loop;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_push_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.dispatch_notification_push(new.id);
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.dispatch_notification_push(p_notification_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_notification public.notifications%rowtype;
  v_webhook_secret text;
  v_request_id bigint;
begin
  select * into v_notification
  from public.notifications notification
  where notification.id = p_notification_id
  for update;

  if not found
    or not coalesce((v_notification.delivery_channels ->> 'push')::boolean, false)
    or v_notification.scheduled_for > now()
    or v_notification.push_status not in ('pending', 'deferred', 'dispatching') then
    return false;
  end if;

  select decrypted_secret into v_webhook_secret
  from vault.decrypted_secrets
  where name = 'send_push_webhook_secret';

  if v_webhook_secret is null then
    update public.notifications
    set push_status = 'failed', push_attempted_at = now()
    where id = p_notification_id;
    return false;
  end if;

  update public.notifications
  set push_status = 'dispatching', push_attempted_at = now()
  where id = p_notification_id;

  select net.http_post(
    url := 'https://uhwkrxihyqkagirdjhht.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', v_webhook_secret
    ),
    body := jsonb_build_object(
      'notification_id', v_notification.id::text,
      'user_id', v_notification.user_id::text,
      'title', v_notification.title,
      'body', v_notification.body,
      'data', coalesce(v_notification.data, '{}'::jsonb) || jsonb_build_object(
        'notification_id', v_notification.id::text,
        'notification_type', v_notification.type,
        'priority', v_notification.priority
      )
    ),
    timeout_milliseconds := 15000
  ) into v_request_id;
  return v_request_id is not null;
exception
  when others then
    update public.notifications
    set push_status = 'failed', push_attempted_at = now()
    where id = p_notification_id;
    return false;
end;
$function$;

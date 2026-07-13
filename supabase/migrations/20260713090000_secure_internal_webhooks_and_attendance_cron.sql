-- Protect database-triggered Edge Functions with purpose-specific secrets.
-- The VAPID private key is configured separately as an Edge Function secret
-- or as vault secret `vapid_private_key`; it is intentionally not committed.

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'send_push_webhook_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'send_push_webhook_secret',
      'Authenticates database push-notification webhooks'
    );
  end if;

  if not exists (select 1 from vault.decrypted_secrets where name = 'attendance_cron_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'attendance_cron_secret',
      'Authenticates attendance cron webhooks'
    );
  end if;
end $$;

create or replace function public.get_internal_webhook_secret(p_purpose text)
returns text
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  v_secret_name text;
  v_secret text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  v_secret_name := case p_purpose
    when 'send_push' then 'send_push_webhook_secret'
    when 'attendance_cron' then 'attendance_cron_secret'
    else null
  end;

  if v_secret_name is null then
    raise exception 'Unknown internal webhook purpose' using errcode = '22023';
  end if;

  select decrypted_secret
  into v_secret
  from vault.decrypted_secrets
  where name = v_secret_name;

  return v_secret;
end;
$$;

create or replace function public.get_push_runtime_config()
returns jsonb
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  v_webhook_secret text;
  v_vapid_private_key text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  select decrypted_secret into v_webhook_secret
  from vault.decrypted_secrets
  where name = 'send_push_webhook_secret';

  select decrypted_secret into v_vapid_private_key
  from vault.decrypted_secrets
  where name = 'vapid_private_key';

  return jsonb_build_object(
    'webhook_secret', v_webhook_secret,
    'vapid_private_key', v_vapid_private_key
  );
end;
$$;

revoke all on function public.get_internal_webhook_secret(text) from public, anon, authenticated;
revoke all on function public.get_push_runtime_config() from public, anon, authenticated;
grant execute on function public.get_internal_webhook_secret(text) to service_role;
grant execute on function public.get_push_runtime_config() to service_role;

create or replace function public.trigger_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  v_request_id bigint;
  v_webhook_secret text;
begin
  select decrypted_secret into v_webhook_secret
  from vault.decrypted_secrets
  where name = 'send_push_webhook_secret';

  if v_webhook_secret is null then
    raise warning 'Push webhook secret is not configured';
    return new;
  end if;

  select net.http_post(
    url := 'https://uhwkrxihyqkagirdjhht.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', v_webhook_secret
    ),
    body := jsonb_build_object(
      'user_id', new.user_id::text,
      'title', new.title,
      'body', new.body,
      'data', coalesce(new.data, '{}'::jsonb) || jsonb_build_object(
        'notification_id', new.id::text,
        'notification_type', new.type
      )
    ),
    timeout_milliseconds := 15000
  ) into v_request_id;

  return new;
exception
  when others then
    raise warning 'Push notification request failed: %', sqlerrm;
    return new;
end;
$$;

create or replace function public.push_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  v_sender_name text;
  v_conversation public.conversations%rowtype;
  v_member record;
  v_notification_title text;
  v_notification_body text;
  v_notification_url text;
  v_request_id bigint;
  v_webhook_secret text;
  v_mentioned_user_ids uuid[] := '{}'::uuid[];
begin
  select decrypted_secret into v_webhook_secret
  from vault.decrypted_secrets
  where name = 'send_push_webhook_secret';

  if v_webhook_secret is null then
    raise warning 'Push webhook secret is not configured';
    return new;
  end if;

  select coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), 'Someone')
  into v_sender_name
  from public.profiles p
  where p.id = new.sender_id;

  select * into v_conversation
  from public.conversations
  where id = new.conversation_id;

  if v_conversation.id is null then
    return new;
  end if;

  select coalesce(array_agg(em.user_id), '{}'::uuid[])
  into v_mentioned_user_ids
  from public.extract_conversation_mentions(new.content, new.conversation_id, new.sender_id) em;

  v_notification_url := '/messages/' || new.conversation_id;

  if v_conversation.type = 'event' then
    select coalesce(title, 'Event Discussion') into v_notification_title
    from public.events where id = v_conversation.event_id;
  elsif v_conversation.type = 'personal' then
    v_notification_title := coalesce(v_sender_name, 'New message');
  else
    v_notification_title := coalesce(nullif(v_conversation.name, ''), 'Group Chat');
  end if;

  v_notification_body := coalesce(v_sender_name, 'Someone') || ': ' || public.chat_message_preview(new.content);

  for v_member in
    select cm.user_id
    from public.conversation_members cm
    where cm.conversation_id = new.conversation_id
      and cm.user_id <> new.sender_id
      and not (cm.user_id = any(v_mentioned_user_ids))
  loop
    select net.http_post(
      url := 'https://uhwkrxihyqkagirdjhht.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-internal-secret', v_webhook_secret
      ),
      body := jsonb_build_object(
        'user_id', v_member.user_id::text,
        'title', v_notification_title,
        'body', v_notification_body,
        'data', jsonb_build_object(
          'url', v_notification_url,
          'conversation_id', new.conversation_id,
          'message_id', new.id,
          'sender_id', new.sender_id,
          'notification_id', new.id,
          'notification_type', 'message'
        )
      ),
      timeout_milliseconds := 15000
    ) into v_request_id;
  end loop;

  return new;
exception
  when others then
    raise warning 'Chat push notification request failed: %', sqlerrm;
    return new;
end;
$$;

revoke all on function public.trigger_push_notification() from public, anon, authenticated;
revoke all on function public.push_chat_message() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('check-attendance-timed-reminders');
exception when others then null;
end $$;

do $$
begin
  perform cron.unschedule('check-attendance-mark-absent');
exception when others then null;
end $$;

select cron.schedule(
  'check-attendance-timed-reminders',
  '* * * * *',
  $$
  with config as (
    select decrypted_secret as webhook_secret
    from vault.decrypted_secrets
    where name = 'attendance_cron_secret'
  )
  select net.http_post(
    url := 'https://uhwkrxihyqkagirdjhht.supabase.co/functions/v1/check-attendance?action=timed_reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', webhook_secret
    ),
    body := '{}'::jsonb
  )
  from config;
  $$
);

select cron.schedule(
  'check-attendance-mark-absent',
  '5 16 * * *',
  $$
  with config as (
    select decrypted_secret as webhook_secret
    from vault.decrypted_secrets
    where name = 'attendance_cron_secret'
  )
  select net.http_post(
    url := 'https://uhwkrxihyqkagirdjhht.supabase.co/functions/v1/check-attendance?action=mark_absent',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', webhook_secret
    ),
    body := '{}'::jsonb
  )
  from config;
  $$
);

-- Function grants already restrict these secret lookups to service_role.
-- Avoid relying on request.jwt.claim.role, which is not populated consistently
-- for service-role RPC calls through PostgREST.

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

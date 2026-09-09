-- Explicit, tenant-scoped admin test broadcast. No fixed email recipient.
create or replace function private.send_notification_template_test_to_admins(
  p_rule_type text, p_title text, p_body text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_org_id uuid;
  v_recipients uuid[];
  v_queued integer;
  v_push integer;
begin
  select org_id into v_org_id from public.profiles where id = auth.uid();
  if auth.uid() is null or v_org_id is null or not (
    coalesce(public.auth_is_org_admin(), false)
    or coalesce(public.is_platform_owner(), false)
    or coalesce(public.has_org_capability('manage_notifications'), false)
  ) then
    raise exception 'You do not have permission to send notification tests' using errcode = '42501';
  end if;
  if nullif(btrim(p_title), '') is null or nullif(btrim(p_body), '') is null then
    raise exception 'Enter both a title and message before sending a test' using errcode = '22023';
  end if;
  if private.notification_template_has_placeholders(p_title)
    or private.notification_template_has_placeholders(p_body) then
    raise exception 'Replace unsupported placeholders before sending a test' using errcode = '22023';
  end if;
  -- Admin role is supported alongside the organization-admin flag. DISTINCT
  -- recipient IDs prevent duplicates when an admin also has several roles.
  select array_agg(p.id) into v_recipients from public.profiles p
  where p.org_id = v_org_id and p.is_onboarded and p.ministry_status = 'active'
    and (p.is_org_admin or exists (
      select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
      where ur.user_id = p.id and ur.org_id = v_org_id and r.name = 'Admin'
    ));
  if coalesce(cardinality(v_recipients), 0) = 0 then
    raise exception 'No active admins are available in your church' using errcode = 'P0002';
  end if;
  -- The normal insert hook still applies push settings and member preferences.
  with inserted as (
    insert into public.notifications(user_id, org_id, type, title, body, data)
    select recipient, v_org_id, 'push_test', left(btrim(p_title), 200), left(btrim(p_body), 2000),
      jsonb_build_object('url', '/notifications', 'test', true,
        'source_rule_type', p_rule_type, 'sent_by', auth.uid(),
        'dedupe_key', 'admin-template-test:' || gen_random_uuid()::text)
    from unnest(v_recipients) recipient
    returning delivery_channels
  ) select count(*), count(*) filter (where delivery_channels ->> 'push' = 'true')
    into v_queued, v_push from inserted;
  return jsonb_build_object('admin_count', cardinality(v_recipients),
    'queued_count', v_queued, 'push_queued_count', v_push,
    'skipped_count', cardinality(v_recipients) - v_queued);
end;
$$;
revoke all on function private.send_notification_template_test_to_admins(text,text,text) from public, anon, authenticated;

-- Narrow API bridge: no arguments can select an organization or recipient.
create or replace function public.send_notification_template_test_to_admins(
  p_rule_type text, p_title text, p_body text
) returns jsonb language sql security definer set search_path = '' as $$
  select private.send_notification_template_test_to_admins(p_rule_type, p_title, p_body);
$$;
revoke all on function public.send_notification_template_test_to_admins(text,text,text) from public, anon;
grant execute on function public.send_notification_template_test_to_admins(text,text,text) to authenticated;

-- Preview notification rule wording on the dedicated Admin Dev account without
-- saving the rule first. Access matches the notification control center.

create or replace function public.send_notification_template_test_to_admin_dev(
  p_rule_type text,
  p_title text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_admin_dev_id uuid;
  v_notification_id uuid;
begin
  select profile.org_id
  into v_org_id
  from public.profiles profile
  where profile.id = auth.uid()
    and (
      profile.is_org_admin = true
      or lower(coalesce((select auth.jwt() ->> 'email'), '')) in (
        'bryanbetes11@gmail.com',
        'fwd.bryanashleybetes@gmail.com',
        'bryanashleybetes@gmail.com'
      )
    );

  if v_org_id is null then
    raise exception 'Only organization admins and approved owners can send template tests'
      using errcode = '42501';
  end if;

  if nullif(btrim(p_title), '') is null or nullif(btrim(p_body), '') is null then
    raise exception 'A test notification requires both a title and message'
      using errcode = '22023';
  end if;

  select profile.id
  into v_admin_dev_id
  from public.profiles profile
  where profile.org_id = v_org_id
    and lower(profile.email) = 'bryanbetes11@gmail.com'
    and profile.is_onboarded = true
  limit 1;

  if v_admin_dev_id is null then
    raise exception 'Admin Dev is not available in your organization'
      using errcode = 'P0002';
  end if;

  insert into public.notifications (user_id, org_id, type, title, body, data)
  values (
    v_admin_dev_id,
    v_org_id,
    'push_test',
    left(btrim(p_title), 200),
    left(btrim(p_body), 2000),
    jsonb_build_object(
      'url', '/notifications',
      'test', true,
      'source_rule_type', coalesce(nullif(btrim(p_rule_type), ''), 'notification_rule'),
      'dedupe_key', 'notification-template-test:' || gen_random_uuid()::text
    )
  )
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

revoke all on function public.send_notification_template_test_to_admin_dev(text, text, text)
  from public, anon;
grant execute on function public.send_notification_template_test_to_admin_dev(text, text, text)
  to authenticated;

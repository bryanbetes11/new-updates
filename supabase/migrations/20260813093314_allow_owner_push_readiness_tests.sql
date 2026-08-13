-- Keep push-readiness tests available to organization admins and the same
-- approved owner accounts that can inspect notification readiness.

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
    and (
      profile.is_org_admin = true
      or lower(coalesce((select auth.jwt() ->> 'email'), '')) in (
        'bryanbetes11@gmail.com',
        'fwd.bryanashleybetes@gmail.com',
        'bryanashleybetes@gmail.com'
      )
    );

  if v_org_id is null then
    raise exception 'Only organization admins and approved owners can send push tests'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles target
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

revoke all on function public.send_push_readiness_test(uuid) from public, anon;
grant execute on function public.send_push_readiness_test(uuid) to authenticated;

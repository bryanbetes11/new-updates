-- Make notification-template previews look like real member notifications by
-- replacing friendly bracket placeholders with realistic sample values.

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
  v_title text := btrim(p_title);
  v_body text := btrim(p_body);
  v_samples jsonb := jsonb_build_object(
    'role', 'Song Leader',
    'event', 'Sunday Service',
    'event date', 'August 16, 2026',
    'date', 'August 16, 2026',
    'start time', '7:30 AM',
    'member', 'Bro. Bryan Betes',
    'song leader', 'Bro. Bryan Betes',
    'count', '3',
    'offense level', '2nd Offense',
    'quarter', 'Q3 2026',
    'next action', 'Leadership follow-up',
    'review notes', 'Please update the final song order.',
    'category', 'Audio',
    'status', 'Open',
    'due date', 'August 18, 2026',
    'due status', 'due tomorrow',
    'announcement title', 'Weekend Ministry Update',
    'announcement content', 'Please review this weekend''s schedule in ServeSync.',
    'video', 'Sunday Service Recording',
    'video title', 'Sunday Service Recording',
    'video description', 'The latest service recording is ready to watch.',
    'conversation', 'Sunday Service Team',
    'organization name', 'MCJC Church',
    'sender', 'Bro. Bryan Betes',
    'message preview', 'Please check the updated serving schedule.',
    'reason', 'School event',
    'their assignment', 'Song Leader · 7:30 AM',
    'your assignment', 'Guitar · 7:30 AM',
    'ministry role', 'Song Leader',
    'conduct record', 'Attendance follow-up'
  );
  v_pair record;
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

  if nullif(v_title, '') is null or nullif(v_body, '') is null then
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

  for v_pair in select key, value from jsonb_each_text(v_samples)
  loop
    v_title := replace(v_title, '[' || v_pair.key || ']', v_pair.value);
    v_title := replace(v_title, '[' || initcap(v_pair.key) || ']', v_pair.value);
    v_title := replace(v_title, '{{' || replace(v_pair.key, ' ', '_') || '}}', v_pair.value);
    v_body := replace(v_body, '[' || v_pair.key || ']', v_pair.value);
    v_body := replace(v_body, '[' || initcap(v_pair.key) || ']', v_pair.value);
    v_body := replace(v_body, '{{' || replace(v_pair.key, ' ', '_') || '}}', v_pair.value);
  end loop;

  insert into public.notifications (user_id, org_id, type, title, body, data)
  values (
    v_admin_dev_id,
    v_org_id,
    'push_test',
    left(v_title, 200),
    left(v_body, 2000),
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

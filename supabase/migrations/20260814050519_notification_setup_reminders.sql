create or replace function public.send_notification_setup_reminder(p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_org_id uuid;
begin
  select profile.org_id into v_org_id from public.profiles profile
  where profile.id = auth.uid()
    and (profile.is_org_admin or public.is_platform_owner() or public.has_org_capability('manage_notifications'));
  if v_org_id is null then raise exception 'Not authorized' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id and org_id = v_org_id and ministry_status = 'active') then
    raise exception 'Member not found' using errcode = '42501';
  end if;
  insert into public.notifications (org_id, user_id, type, title, body, data)
  values (v_org_id, p_user_id, 'notification_setup_reminder', 'Enable ServeSync notifications',
    'Open your profile notification settings so you do not miss assignments, schedules, and ministry updates.',
    jsonb_build_object('url', '/profile', 'notification_type', 'notification_setup_reminder'));
end;
$$;
revoke all on function public.send_notification_setup_reminder(uuid) from public, anon;
grant execute on function public.send_notification_setup_reminder(uuid) to authenticated;

-- Historical registrations are not proof an APK is still installed or in use.
-- Only observed Android app activity in the current church pauses reminders.
create function public.has_recent_android_app_activity()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.member_app_access a
    where a.user_id = auth.uid() and a.org_id = public.auth_org_id()
      and a.app_kind = 'android_app'
      and a.last_seen_at > now() - interval '7 days'
  );
$$;
revoke all on function public.has_recent_android_app_activity() from public, anon;
grant execute on function public.has_recent_android_app_activity() to authenticated;

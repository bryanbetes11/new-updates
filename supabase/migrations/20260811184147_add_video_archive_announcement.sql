create or replace function public.notify_team_about_video_archive()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_recipient_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select p.org_id
  into v_org_id
  from public.profiles p
  where p.id = v_user_id;

  if v_org_id is null or not exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = v_user_id
      and ur.org_id = v_org_id
      and r.name = 'Production Director'
  ) then
    raise exception 'Only a Production Director can notify the team about the video archive';
  end if;

  select count(*)::integer
  into v_recipient_count
  from public.profiles p
  where p.org_id = v_org_id
    and p.id <> v_user_id;

  perform public.notify_all_except(
    v_user_id,
    'video',
    '2026 Sunday Service Recordings are now available',
    'All available Praise and Worship recordings from our 2026 Sunday Services have now been uploaded to ServeSync.',
    jsonb_build_object('url', '/library?tab=videos')
  );

  return v_recipient_count;
end;
$$;

revoke all on function public.notify_team_about_video_archive() from public, anon;
grant execute on function public.notify_team_about_video_archive() to authenticated;

create or replace function public.notify_team_about_video(p_video_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_video public.videos%rowtype;
  v_recipient_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_video
  from public.videos
  where id = p_video_id;

  if not found then
    raise exception 'Video not found';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = v_user_id
      and ur.org_id = v_video.org_id
      and r.name = 'Production Director'
  ) then
    raise exception 'Only a Production Director can notify the team about a video';
  end if;

  select count(*)::integer
  into v_recipient_count
  from public.profiles p
  where p.org_id = v_video.org_id
    and p.id <> v_user_id;

  perform public.notify_all_except(
    v_user_id,
    'video',
    'Sunday Service Praise & Worship is now available',
    v_video.title || ' has been uploaded to the ServeSync video library.',
    jsonb_build_object(
      'video_id', v_video.id::text,
      'url', '/library?tab=videos&video=' || v_video.id::text
    )
  );

  return v_recipient_count;
end;
$$;

revoke all on function public.notify_team_about_video(uuid) from public, anon;
grant execute on function public.notify_team_about_video(uuid) to authenticated;

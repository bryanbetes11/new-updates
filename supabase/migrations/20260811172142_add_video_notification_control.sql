alter table public.videos
  add column if not exists notify_members boolean not null default true;

comment on column public.videos.notify_members is
  'Whether a Production Director requested member notifications for this video import.';

create or replace function public.on_video_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Only a Production Director in the same organization may suppress the
  -- automatic notification. Everyone else keeps the existing behavior even
  -- if they attempt to submit notify_members = false through the Data API.
  if new.notify_members is false and exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = new.uploaded_by
      and ur.org_id = new.org_id
      and r.name = 'Production Director'
  ) then
    return new;
  end if;

  perform public.notify_all_except(
    new.uploaded_by,
    'video',
    'New Video: ' || new.title,
    coalesce(left(new.description, 200), 'A new video has been uploaded'),
    jsonb_build_object('video_id', new.id::text, 'url', '/library')
  );

  return new;
end;
$$;

revoke execute on function public.on_video_created() from public, anon, authenticated;

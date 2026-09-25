-- Announcement photos can include leaders-only information, so authorize
-- downloads against the announcement row instead of its former public URL.
create or replace function storage.can_read_announcement_image(p_name text,p_viewer uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_uploader uuid;
begin
  if p_viewer is null or p_name !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$' then return false; end if;
  v_uploader := split_part(p_name,'/',1)::uuid;
  if v_uploader=p_viewer then return true; end if;
  return exists (
    select 1 from public.announcements a
    join public.profiles viewer on viewer.id=p_viewer and viewer.org_id=a.org_id
    where a.created_by=v_uploader
      and position('/announcements/' || p_name in a.content_blocks::text)>0
      and (not coalesce(a.is_leaders_only,false) or public.auth_is_org_leader())
  );
end;
$$;
revoke all on function storage.can_read_announcement_image(text,uuid) from public,anon,authenticated;
grant execute on function storage.can_read_announcement_image(text,uuid) to authenticated;
drop policy if exists "Anyone can view announcement images" on storage.objects;
drop policy if exists "Authenticated users can upload announcement images" on storage.objects;
create policy "Church readers can sign announcement images" on storage.objects
  for select to authenticated
  using (bucket_id='announcements' and storage.can_read_announcement_image(name,(select auth.uid())));
create policy "Members upload own announcement images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id='announcements'
    and (storage.foldername(name))[1]=(select auth.uid())::text
    and array_length(storage.foldername(name),1)=1
    and (select public.auth_org_id()) is not null
  );
update storage.buckets set public=false,file_size_limit=8388608,
  allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','image/avif']
where id='announcements';

-- No backfill: older read flags cannot prove an actual notification open.
-- Filename matches the version assigned when this migration was applied remotely.
create table public.notification_activity (
  notification_id uuid primary key,
  group_id uuid not null,
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  notification_type text not null,
  created_at timestamptz not null,
  push_status text,
  is_read boolean not null default false,
  push_opened_at timestamptz,
  bell_opened_at timestamptz,
  page_opened_at timestamptz
);
-- Intentionally no FK to notifications: clearing an inbox must not erase activity.
create index notification_activity_org_created_idx on public.notification_activity(org_id, created_at desc);
create index notification_activity_group_idx on public.notification_activity(org_id, group_id);
alter table public.notification_activity enable row level security;
revoke all on public.notification_activity from public, anon, authenticated;
grant select on public.notification_activity to authenticated;
create policy notification_activity_admin_read on public.notification_activity for select to authenticated
using (org_id = (select public.auth_org_id()) and (
  (select public.auth_is_org_admin()) or (select public.is_platform_owner()) or exists (
    select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
    where ur.user_id = (select auth.uid()) and ur.org_id = notification_activity.org_id and r.name = 'Admin'
  )
));

create or replace function private.capture_notification_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.type = 'message' then return new; end if;
    insert into public.notification_activity(notification_id, group_id, org_id, user_id, title,
      notification_type, created_at, push_status, is_read)
    values (new.id,
      md5(jsonb_build_array(new.org_id, new.type, new.title, new.body,
        new.data ->> 'url', new.data ->> 'event_id', new.data ->> 'announcement_id',
        new.data ->> 'video_id', statement_timestamp())::text)::uuid,
      new.org_id, new.user_id, new.title, new.type, new.created_at, new.push_status, new.is_read)
    on conflict (notification_id) do nothing;
  else
    update public.notification_activity set push_status = new.push_status, is_read = new.is_read
      where notification_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function private.capture_notification_activity() from public, anon, authenticated;
create trigger capture_notification_activity after insert or update of push_status, is_read
on public.notifications for each row execute function private.capture_notification_activity();

create or replace function private.record_notification_open(p_notification_id uuid, p_source text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if auth.uid() is null then raise exception 'Sign in to record a notification open' using errcode='42501'; end if;
  if p_source not in ('push','bell','page') or p_source is null then
    raise exception 'Invalid notification source' using errcode='22023';
  end if;
  update public.notification_activity set
    push_opened_at = case when p_source = 'push' then coalesce(push_opened_at,now()) else push_opened_at end,
    bell_opened_at = case when p_source = 'bell' then coalesce(bell_opened_at,now()) else bell_opened_at end,
    page_opened_at = case when p_source = 'page' then coalesce(page_opened_at,now()) else page_opened_at end
  where notification_id = p_notification_id and user_id = auth.uid() and org_id = public.auth_org_id();
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;
revoke all on function private.record_notification_open(uuid,text) from public, anon, authenticated;
create or replace function public.record_notification_open(p_notification_id uuid, p_source text)
returns boolean language sql security definer set search_path = '' as $$
  select private.record_notification_open(p_notification_id, p_source);
$$;
revoke all on function public.record_notification_open(uuid,text) from public, anon;
grant execute on function public.record_notification_open(uuid,text) to authenticated;

-- Invoker functions preserve the table's same-church admin-only SELECT policy.
create or replace function public.get_notification_activity_groups(p_offset integer default 0)
returns table(group_id uuid, title text, notification_type text, created_at timestamptz,
  recipient_count bigint, opened_count bigint)
language sql stable security invoker set search_path = '' as $$
  select a.group_id, min(a.title), min(a.notification_type), min(a.created_at), count(*),
    count(*) filter (where a.push_opened_at is not null or a.bell_opened_at is not null or a.page_opened_at is not null)
  from public.notification_activity a
  group by a.group_id order by min(a.created_at) desc, a.group_id
  limit 25 offset greatest(0, least(coalesce(p_offset,0),100000));
$$;
revoke all on function public.get_notification_activity_groups(integer) from public, anon;
grant execute on function public.get_notification_activity_groups(integer) to authenticated;

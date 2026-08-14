-- Connected workspace foundation:
-- canonical member inclusion, capability grants, synced UI preferences,
-- video viewer history, and church-scoped leadership audit access.

create table if not exists public.organization_member_settings (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  include_in_attendance boolean not null default true,
  include_in_surveys boolean not null default true,
  include_in_assignments boolean not null default true,
  exclusion_reason text,
  capabilities jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (org_id, user_id),
  constraint organization_member_settings_capabilities_object
    check (jsonb_typeof(capabilities) = 'object')
);

alter table public.organization_member_settings enable row level security;
grant select, insert, update on public.organization_member_settings to authenticated;

create policy "Members can read church member settings"
  on public.organization_member_settings for select to authenticated
  using (org_id = (select public.auth_org_id()));

create policy "Church admins manage member settings"
  on public.organization_member_settings for insert to authenticated
  with check (
    org_id = (select public.auth_org_id())
    and ((select public.auth_is_org_admin()) or (select public.is_platform_owner()))
  );

create policy "Church admins update member settings"
  on public.organization_member_settings for update to authenticated
  using (
    org_id = (select public.auth_org_id())
    and ((select public.auth_is_org_admin()) or (select public.is_platform_owner()))
  )
  with check (
    org_id = (select public.auth_org_id())
    and ((select public.auth_is_org_admin()) or (select public.is_platform_owner()))
  );

insert into public.organization_member_settings (org_id, user_id, include_in_attendance, include_in_surveys, include_in_assignments)
select profile.org_id, profile.id,
  profile.ministry_status = 'active',
  profile.ministry_status = 'active',
  profile.ministry_status = 'active'
from public.profiles profile
where profile.org_id is not null
on conflict (org_id, user_id) do nothing;

create or replace function public.has_org_capability(p_capability text)
returns boolean
language sql stable security invoker set search_path = public
as $$
  select coalesce((settings.capabilities ->> p_capability)::boolean, false)
  from public.organization_member_settings settings
  where settings.org_id = (select public.auth_org_id()) and settings.user_id = (select auth.uid());
$$;
revoke all on function public.has_org_capability(text) from public, anon;
grant execute on function public.has_org_capability(text) to authenticated;

drop policy if exists "Org admins and approved owners can update notification settings" on public.notification_system_settings;
create policy "Authorized leaders update notification settings"
  on public.notification_system_settings for update to authenticated
  using (org_id = (select public.auth_org_id()) and ((select public.auth_is_org_admin()) or (select public.is_platform_owner()) or (select public.has_org_capability('manage_notifications'))))
  with check (org_id = (select public.auth_org_id()) and ((select public.auth_is_org_admin()) or (select public.is_platform_owner()) or (select public.has_org_capability('manage_notifications'))));

drop policy if exists "Org admins and approved owners can update notification rules" on public.notification_rules;
create policy "Authorized leaders update notification rules"
  on public.notification_rules for update to authenticated
  using (org_id = (select public.auth_org_id()) and ((select public.auth_is_org_admin()) or (select public.is_platform_owner()) or (select public.has_org_capability('manage_notifications'))))
  with check (org_id = (select public.auth_org_id()) and ((select public.auth_is_org_admin()) or (select public.is_platform_owner()) or (select public.has_org_capability('manage_notifications'))));

create table if not exists public.user_ui_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  preference_key text not null,
  preference_value jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, preference_key)
);

alter table public.user_ui_preferences enable row level security;
grant select, insert, update, delete on public.user_ui_preferences to authenticated;

create policy "Users read own UI preferences"
  on public.user_ui_preferences for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Users create own UI preferences"
  on public.user_ui_preferences for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Users update own UI preferences"
  on public.user_ui_preferences for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Users delete own UI preferences"
  on public.user_ui_preferences for delete to authenticated
  using (user_id = (select auth.uid()));

create table if not exists public.video_views (
  org_id uuid not null references public.organizations(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  first_viewed_at timestamptz not null default now(),
  last_viewed_at timestamptz not null default now(),
  view_count integer not null default 1 check (view_count > 0),
  primary key (video_id, user_id)
);

create index if not exists video_views_org_video_last_idx
  on public.video_views (org_id, video_id, last_viewed_at desc);

alter table public.video_views enable row level security;
grant select, insert, update on public.video_views to authenticated;

create policy "Church members can see video viewers"
  on public.video_views for select to authenticated
  using (org_id = (select public.auth_org_id()));
create policy "Users record own video views"
  on public.video_views for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and org_id = (select public.auth_org_id())
  );
create policy "Users update own video views"
  on public.video_views for update to authenticated
  using (user_id = (select auth.uid()) and org_id = (select public.auth_org_id()))
  with check (user_id = (select auth.uid()) and org_id = (select public.auth_org_id()));

create or replace function public.record_video_view(p_video_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid := (select public.auth_org_id());
begin
  if (select auth.uid()) is null or v_org_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.videos where id = p_video_id and org_id = v_org_id) then
    raise exception 'Video not found in your church' using errcode = '42501';
  end if;

  insert into public.video_views (org_id, video_id, user_id)
  values (v_org_id, p_video_id, (select auth.uid()))
  on conflict (video_id, user_id) do update
    set last_viewed_at = now(), view_count = public.video_views.view_count + 1;
end;
$$;
revoke all on function public.record_video_view(uuid) from public, anon;
grant execute on function public.record_video_view(uuid) to authenticated;

drop policy if exists "Platform owner can view own church activity logs" on public.activity_logs;
create policy "Church admins can view own church activity logs"
  on public.activity_logs for select to authenticated
  using (
    org_id = (select public.auth_org_id())
    and ((select public.auth_is_org_admin()) or (select public.is_platform_owner()))
  );

-- Keep the activity stream useful without logging every passive video open.
create or replace function public.touch_connected_workspace_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_member_settings_updated_at on public.organization_member_settings;
create trigger trg_member_settings_updated_at before update on public.organization_member_settings
for each row execute function public.touch_connected_workspace_updated_at();

drop trigger if exists trg_user_ui_preferences_updated_at on public.user_ui_preferences;
create trigger trg_user_ui_preferences_updated_at before update on public.user_ui_preferences
for each row execute function public.touch_connected_workspace_updated_at();

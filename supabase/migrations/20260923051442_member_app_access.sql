-- Small per-member summaries, not a device fingerprint or browsing history.
create table public.member_app_access (
  user_id uuid not null references public.profiles(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  app_kind text not null check (app_kind in ('android_app','ios_app','pwa','browser')),
  platform text not null check (platform in ('android','ios','other')),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, org_id, app_kind, platform),
  check ((app_kind <> 'android_app' or platform = 'android') and
         (app_kind <> 'ios_app' or platform = 'ios'))
);
create index member_app_access_org on public.member_app_access(org_id);
alter table public.member_app_access enable row level security;
revoke all on public.member_app_access from anon, authenticated;
grant select on public.member_app_access to authenticated;
grant all on public.member_app_access to service_role;
create policy member_app_access_admin_read on public.member_app_access for select to authenticated
using (
  org_id = (select public.auth_org_id()) and (select public.auth_is_org_admin())
  and exists (select 1 from public.profiles p where p.id = user_id and p.org_id = member_app_access.org_id)
);

-- A narrow write API derives ownership and timestamps on the server. Clients
-- cannot submit another member ID, organization ID, or fabricated last-seen time.
create function public.record_member_app_access(p_app_kind text, p_platform text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_org uuid;
begin
  if v_user is null then raise exception 'Sign in required'; end if;
  select org_id into v_org from public.profiles where id = v_user;
  if v_org is null then raise exception 'Organization required'; end if;
  if p_app_kind is null or p_app_kind not in ('android_app','ios_app','pwa','browser')
    or p_platform is null or p_platform not in ('android','ios','other')
    or (p_app_kind = 'android_app' and p_platform <> 'android')
    or (p_app_kind = 'ios_app' and p_platform <> 'ios') then
    raise exception 'Invalid app access type';
  end if;
  insert into public.member_app_access(user_id,org_id,app_kind,platform,last_seen_at)
    values(v_user,v_org,p_app_kind,p_platform,clock_timestamp())
  on conflict (user_id,org_id,app_kind,platform) do update
    set last_seen_at = excluded.last_seen_at
    where public.member_app_access.last_seen_at < clock_timestamp() - interval '5 minutes';
end;
$$;
revoke all on function public.record_member_app_access(text,text) from public, anon;
grant execute on function public.record_member_app_access(text,text) to authenticated;

-- Only answers for the caller; does not expose another member or push credentials.
create function public.has_used_android_app()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    exists (select 1 from public.member_app_access a
      where a.user_id = auth.uid() and a.org_id = public.auth_org_id() and a.app_kind = 'android_app')
    or exists (select 1 from public.native_push_devices d
      where d.user_id = auth.uid() and d.org_id = public.auth_org_id())
  );
$$;
revoke all on function public.has_used_android_app() from public, anon;
grant execute on function public.has_used_android_app() to authenticated;

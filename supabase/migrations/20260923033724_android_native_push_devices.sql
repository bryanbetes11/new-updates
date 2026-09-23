-- Device ownership is proven by a random installation secret, never by an FCM token.
create table public.native_push_devices (
  installation_id uuid primary key,
  secret_hash bytea not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  token text unique,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  check (token is null or length(token) between 20 and 4096)
);
alter table public.native_push_devices enable row level security;
revoke all on public.native_push_devices from anon, authenticated;
grant select (installation_id, user_id, org_id, enabled) on public.native_push_devices to authenticated;
grant all on public.native_push_devices to service_role;
create policy native_push_own_device on public.native_push_devices for select to authenticated
  using (user_id = (select auth.uid()) and org_id = (select org_id from public.profiles where id = auth.uid()));
create index native_push_recipient on public.native_push_devices(user_id, org_id) where enabled;

create function public.claim_native_push_device(p_installation_id uuid, p_secret text, p_token text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_org uuid;
  v_hash bytea;
begin
  if v_user is null then raise exception 'Sign in to enable notifications'; end if;
  select org_id into v_org from public.profiles where id = v_user;
  if v_org is null then raise exception 'Organization required'; end if;
  if p_installation_id is null or p_secret is null or p_secret !~ '^[0-9a-f]{64}$'
    or p_token is null or length(p_token) not between 20 and 4096 then
    raise exception 'Invalid device registration';
  end if;
  v_hash := sha256(convert_to(p_secret, 'UTF8'));
  insert into public.native_push_devices(installation_id, secret_hash, user_id, org_id, token)
  values (p_installation_id, v_hash, v_user, v_org, p_token)
  on conflict (installation_id) do update set
    user_id = excluded.user_id, org_id = excluded.org_id, token = excluded.token,
    enabled = true, updated_at = now()
  where public.native_push_devices.secret_hash = v_hash;
  if not found then raise exception 'Device ownership could not be verified'; end if;
end;
$$;

-- Secret possession permits cleanup after session expiry; it cannot read data or enable delivery.
create function public.revoke_native_push_device(p_installation_id uuid, p_secret text)
returns void language sql security definer set search_path = '' as $$
  update public.native_push_devices set token = null, enabled = false, updated_at = now()
  where installation_id = p_installation_id and secret_hash = sha256(convert_to(p_secret, 'UTF8'));
$$;
revoke all on function public.claim_native_push_device(uuid,text,text) from public, anon;
grant execute on function public.claim_native_push_device(uuid,text,text) to authenticated;
revoke all on function public.revoke_native_push_device(uuid,text) from public;
grant execute on function public.revoke_native_push_device(uuid,text) to anon, authenticated;

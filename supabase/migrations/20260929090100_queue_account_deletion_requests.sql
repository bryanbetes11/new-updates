-- Keep a durable request after sign-in is disabled so shared church records
-- can be reviewed and personal data removed without cascading other members' data.
create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  account_email text not null,
  former_org_id uuid,
  requested_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed')),
  processed_at timestamptz,
  processing_notes text
);

create index account_deletion_requests_status_requested_idx
  on public.account_deletion_requests (status, requested_at);

alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from public, anon, authenticated;
grant all on public.account_deletion_requests to service_role;

comment on table public.account_deletion_requests is
  'Service-only queue for verified account deletion requests; no automatic purge of shared church records.';

-- Called only by the Edge Function after it verifies the caller's Auth token.
-- The queue entry and loss of church access commit together.
create function public.queue_and_disable_account_deletion(
  p_user_id uuid,
  p_account_email text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_request_id uuid;
begin
  if p_user_id is null or nullif(btrim(p_account_email), '') is null then
    raise exception 'A verified account is required';
  end if;

  select org_id into v_org_id
  from public.profiles
  where id = p_user_id
  for update;
  if not found then raise exception 'Account profile not found'; end if;

  insert into public.account_deletion_requests (user_id, account_email, former_org_id)
  values (p_user_id, p_account_email, v_org_id)
  on conflict (user_id) do update
    set account_email = excluded.account_email
  returning id into v_request_id;

  delete from public.native_push_devices where user_id = p_user_id;
  delete from public.push_subscriptions where user_id = p_user_id;
  delete from public.user_roles where user_id = p_user_id;
  update public.profiles
  set org_id = null, is_org_admin = false, updated_at = now()
  where id = p_user_id;

  return v_request_id;
end;
$$;

revoke all on function public.queue_and_disable_account_deletion(uuid, text)
  from public, anon, authenticated;
grant execute on function public.queue_and_disable_account_deletion(uuid, text)
  to service_role;

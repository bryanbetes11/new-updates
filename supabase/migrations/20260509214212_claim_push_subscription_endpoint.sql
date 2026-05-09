-- A browser/PWA push endpoint belongs to one physical browser install, not one
-- app account. When users switch accounts on the same device, move that endpoint
-- to the current auth user so chat pushes do not go to the previous account.

with ranked as (
  select
    id,
    row_number() over (
      partition by endpoint
      order by created_at desc nulls last, id desc
    ) as rn
  from public.push_subscriptions
)
delete from public.push_subscriptions ps
using ranked r
where ps.id = r.id
  and r.rn > 1;

create unique index if not exists push_subscriptions_endpoint_unique
  on public.push_subscriptions (endpoint);

create or replace function public.claim_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth_key text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_id uuid := auth.uid();
  v_org_id uuid;
  v_subscription_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required';
  end if;

  if nullif(trim(p_endpoint), '') is null
    or nullif(trim(p_p256dh), '') is null
    or nullif(trim(p_auth_key), '') is null then
    raise exception 'Invalid push subscription';
  end if;

  select org_id
  into v_org_id
  from public.profiles
  where id = caller_id;

  insert into public.push_subscriptions (
    user_id,
    endpoint,
    p256dh,
    auth_key,
    org_id,
    created_at
  )
  values (
    caller_id,
    p_endpoint,
    p_p256dh,
    p_auth_key,
    v_org_id,
    now()
  )
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth_key = excluded.auth_key,
        org_id = excluded.org_id,
        created_at = now()
  returning id into v_subscription_id;

  return v_subscription_id;
end;
$$;

grant execute on function public.claim_push_subscription(text, text, text) to authenticated;

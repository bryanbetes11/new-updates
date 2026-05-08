-- ============================================================================
-- Platform-owner management helpers
-- ----------------------------------------------------------------------------
-- Purpose:
--   * allow the platform owner to inspect a church in detail
--   * allow the platform owner to view members across churches
--   * allow the platform owner to update church/billing metadata
-- ============================================================================

create or replace function public.get_platform_organization_detail(
  p_org_id uuid
)
returns table (
  id uuid,
  name text,
  slug text,
  logo_url text,
  subscription_status text,
  stripe_customer_id text,
  stripe_subscription_id text,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  seats_purchased integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.id,
    o.name,
    o.slug,
    o.logo_url,
    o.subscription_status,
    o.stripe_customer_id,
    o.stripe_subscription_id,
    o.trial_ends_at,
    o.current_period_end,
    o.seats_purchased,
    o.created_at
  from public.organizations o
  where public.is_platform_owner()
    and o.id = p_org_id
  limit 1;
$$;

create or replace function public.get_platform_organization_members(
  p_org_id uuid
)
returns table (
  profile_id uuid,
  email text,
  first_name text,
  last_name text,
  nickname text,
  is_org_admin boolean,
  is_onboarded boolean,
  ministry_status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.email,
    p.first_name,
    p.last_name,
    p.nickname,
    p.is_org_admin,
    p.is_onboarded,
    p.ministry_status,
    p.created_at
  from public.profiles p
  where public.is_platform_owner()
    and p.org_id = p_org_id
  order by p.created_at desc;
$$;

create or replace function public.update_platform_organization(
  p_org_id uuid,
  p_name text,
  p_logo_url text default null,
  p_subscription_status text default null,
  p_trial_ends_at timestamptz default null,
  p_current_period_end timestamptz default null,
  p_seats_purchased integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_owner() then
    raise exception 'Platform owner access required';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'Church name is required';
  end if;

  if p_subscription_status is not null and p_subscription_status not in ('trialing', 'active', 'past_due', 'canceled', 'incomplete') then
    raise exception 'Invalid subscription status';
  end if;

  update public.organizations
  set
    name = trim(p_name),
    logo_url = nullif(trim(coalesce(p_logo_url, '')), ''),
    subscription_status = p_subscription_status,
    trial_ends_at = p_trial_ends_at,
    current_period_end = p_current_period_end,
    seats_purchased = greatest(coalesce(p_seats_purchased, 0), 0)
  where id = p_org_id;

  if not found then
    raise exception 'Church not found';
  end if;

  return p_org_id;
end;
$$;

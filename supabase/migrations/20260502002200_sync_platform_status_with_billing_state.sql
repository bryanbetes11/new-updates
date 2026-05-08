-- ============================================================================
-- Sync platform status edits with manual billing state
-- ----------------------------------------------------------------------------
-- Purpose:
--   * make platform owner status edits drive the real billing_status field
--   * return billing-aware status from the platform dashboard helpers
--   * backfill existing non-exempt orgs where subscription_status was edited
--     but billing_status remained stale
-- ============================================================================

create or replace function public.get_platform_overview_metrics()
returns table (
  total_churches bigint,
  total_members bigint,
  total_org_admins bigint,
  active_subscriptions bigint,
  trialing_subscriptions bigint,
  past_due_subscriptions bigint,
  canceled_subscriptions bigint,
  pending_invites bigint,
  unattached_registrations bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.organizations),
    (select count(*) from public.profiles where org_id is not null),
    (select count(*) from public.profiles where is_org_admin = true),
    (select count(*) from public.organizations where coalesce(billing_status, subscription_status) = 'active'),
    (select count(*) from public.organizations where coalesce(billing_status, subscription_status) = 'trialing'),
    (select count(*) from public.organizations where coalesce(billing_status, subscription_status) = 'past_due'),
    (select count(*) from public.organizations where coalesce(billing_status, subscription_status) in ('canceled', 'suspended')),
    (select count(*) from public.organization_invitations where accepted_at is null),
    (select count(*) from public.profiles where org_id is null)
  where public.is_platform_owner();
$$;

create or replace function public.get_platform_organization_summaries()
returns table (
  id uuid,
  name text,
  slug text,
  subscription_status text,
  stripe_customer_id text,
  stripe_subscription_id text,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  seats_purchased integer,
  created_at timestamptz,
  member_count bigint,
  org_admin_count bigint,
  event_count bigint,
  announcement_count bigint,
  pending_invite_count bigint
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
    coalesce(o.billing_status, o.subscription_status),
    o.stripe_customer_id,
    o.stripe_subscription_id,
    o.trial_ends_at,
    o.current_period_end,
    o.seats_purchased,
    o.created_at,
    coalesce(member_counts.member_count, 0),
    coalesce(admin_counts.org_admin_count, 0),
    coalesce(event_counts.event_count, 0),
    coalesce(announcement_counts.announcement_count, 0),
    coalesce(invite_counts.pending_invite_count, 0)
  from public.organizations o
  left join (
    select org_id, count(*) as member_count
    from public.profiles
    where org_id is not null
    group by org_id
  ) member_counts on member_counts.org_id = o.id
  left join (
    select org_id, count(*) as org_admin_count
    from public.profiles
    where org_id is not null and is_org_admin = true
    group by org_id
  ) admin_counts on admin_counts.org_id = o.id
  left join (
    select org_id, count(*) as event_count
    from public.events
    group by org_id
  ) event_counts on event_counts.org_id = o.id
  left join (
    select org_id, count(*) as announcement_count
    from public.announcements
    group by org_id
  ) announcement_counts on announcement_counts.org_id = o.id
  left join (
    select org_id, count(*) as pending_invite_count
    from public.organization_invitations
    where accepted_at is null
    group by org_id
  ) invite_counts on invite_counts.org_id = o.id
  where public.is_platform_owner()
  order by o.created_at desc;
$$;

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
    coalesce(o.billing_status, o.subscription_status),
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
declare
  v_billing_status text;
begin
  if not public.is_platform_owner() then
    raise exception 'Platform owner access required';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'Church name is required';
  end if;

  if p_subscription_status is not null and p_subscription_status not in ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'suspended', 'exempt') then
    raise exception 'Invalid subscription status';
  end if;

  v_billing_status := case p_subscription_status
    when 'trialing' then 'trialing'
    when 'active' then 'active'
    when 'past_due' then 'past_due'
    when 'canceled' then 'suspended'
    when 'incomplete' then 'suspended'
    when 'suspended' then 'suspended'
    when 'exempt' then 'exempt'
    else null
  end;

  update public.organizations
  set
    name = trim(p_name),
    logo_url = nullif(trim(coalesce(p_logo_url, '')), ''),
    subscription_status = case
      when p_subscription_status in ('canceled', 'incomplete') then p_subscription_status
      when p_subscription_status in ('trialing', 'active', 'past_due') then p_subscription_status
      else subscription_status
    end,
    billing_status = case
      when is_billing_exempt then 'exempt'
      when v_billing_status is not null then v_billing_status
      else billing_status
    end,
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

update public.organizations
set billing_status = case
  when is_billing_exempt then 'exempt'
  when subscription_status = 'trialing' then 'trialing'
  when subscription_status = 'active' then 'active'
  when subscription_status = 'past_due' then 'past_due'
  when subscription_status in ('canceled', 'incomplete') then 'suspended'
  else billing_status
end
where not is_billing_exempt
  and coalesce(billing_status, '') <> 'submitted'
  and subscription_status is not null
  and billing_status is distinct from case
    when subscription_status = 'trialing' then 'trialing'
    when subscription_status = 'active' then 'active'
    when subscription_status = 'past_due' then 'past_due'
    when subscription_status in ('canceled', 'incomplete') then 'suspended'
    else billing_status
  end;

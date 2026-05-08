-- ============================================================================
-- Auto-reset trial dates when platform owner moves a church back to trialing
-- ----------------------------------------------------------------------------
-- Purpose:
--   * keep create-church behavior unchanged (already auto-sets 10-day trial)
--   * when the platform owner manually changes a church to trialing and does
--     not provide a trial end date, default the trial window from "now"
--   * still allow the platform owner to override the trial end date manually
-- ============================================================================

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
  v_now timestamptz := now();
  v_trial_started_at timestamptz;
  v_trial_ends_at timestamptz;
  v_current_period_end timestamptz;
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

  if p_subscription_status = 'trialing' then
    v_trial_started_at := v_now;
    v_trial_ends_at := coalesce(p_trial_ends_at, v_now + interval '10 days');
    v_current_period_end := p_current_period_end;
  else
    v_trial_started_at := null;
    v_trial_ends_at := p_trial_ends_at;
    v_current_period_end := p_current_period_end;
  end if;

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
    trial_started_at = case
      when p_subscription_status = 'trialing' then v_trial_started_at
      else trial_started_at
    end,
    trial_ends_at = v_trial_ends_at,
    current_period_end = v_current_period_end,
    seats_purchased = greatest(coalesce(p_seats_purchased, 0), 0)
  where id = p_org_id;

  if not found then
    raise exception 'Church not found';
  end if;

  return p_org_id;
end;
$$;

-- ============================================================================
-- Platform owner billing review helpers
-- ----------------------------------------------------------------------------
-- Purpose:
--   * let the platform owner inspect submitted manual payments
--   * verify or reject a submission and update the church billing state
-- ============================================================================

create or replace function public.get_platform_payment_submissions()
returns table (
  id uuid,
  org_id uuid,
  church_name text,
  church_slug text,
  submitted_by uuid,
  submitted_by_email text,
  plan_code text,
  amount numeric,
  billing_reference text,
  payer_name text,
  payment_channel text,
  reference_number text,
  receipt_url text,
  note text,
  status text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ps.id,
    ps.org_id,
    o.name,
    o.slug,
    ps.submitted_by,
    submitter.email,
    ps.plan_code,
    ps.amount,
    ps.billing_reference,
    ps.payer_name,
    ps.payment_channel,
    ps.reference_number,
    ps.receipt_url,
    ps.note,
    ps.status,
    ps.reviewed_by,
    ps.reviewed_at,
    ps.rejection_reason,
    ps.created_at
  from public.organization_payment_submissions ps
  join public.organizations o on o.id = ps.org_id
  left join public.profiles submitter on submitter.id = ps.submitted_by
  where public.is_platform_owner()
  order by
    case when ps.status = 'submitted' then 0 else 1 end,
    ps.created_at desc;
$$;

create or replace function public.review_platform_payment_submission(
  p_submission_id uuid,
  p_action text,
  p_rejection_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.organization_payment_submissions%rowtype;
  v_org public.organizations%rowtype;
  v_now timestamptz := now();
  v_period_end timestamptz;
  v_effective_status text;
begin
  if not public.is_platform_owner() then
    raise exception 'Platform owner access required';
  end if;

  if p_action not in ('verify', 'reject') then
    raise exception 'Invalid action';
  end if;

  select *
  into v_submission
  from public.organization_payment_submissions
  where id = p_submission_id
  limit 1;

  if v_submission.id is null then
    raise exception 'Payment submission not found';
  end if;

  select *
  into v_org
  from public.organizations
  where id = v_submission.org_id
  limit 1;

  if v_org.id is null then
    raise exception 'Church not found';
  end if;

  if p_action = 'verify' then
    v_period_end := case coalesce(v_org.billing_interval, 'monthly')
      when 'annual' then v_now + interval '1 year'
      when 'quarterly' then v_now + interval '3 months'
      when 'custom' then coalesce(v_org.current_period_end, v_now + interval '30 days')
      else v_now + interval '1 month'
    end;

    update public.organization_payment_submissions
    set
      status = 'verified',
      reviewed_by = auth.uid(),
      reviewed_at = v_now,
      rejection_reason = null
    where id = v_submission.id;

    update public.organizations
    set
      billing_status = case when is_billing_exempt then 'exempt' else 'active' end,
      subscription_status = case when is_billing_exempt then subscription_status else 'active' end,
      current_period_start = v_now,
      current_period_end = v_period_end,
      billing_grace_ends_at = null,
      billing_plan = coalesce(v_org.billing_plan, v_submission.plan_code),
      payment_method = case v_submission.payment_channel
        when 'gcash' then 'manual_gcash'
        when 'bank_transfer' then 'manual_bank_transfer'
        else v_org.payment_method
      end,
      seats_purchased = greatest(v_org.seats_purchased, 0)
    where id = v_org.id;
  else
    if coalesce(trim(p_rejection_reason), '') = '' then
      raise exception 'Rejection reason is required';
    end if;

    update public.organization_payment_submissions
    set
      status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = v_now,
      rejection_reason = trim(p_rejection_reason)
    where id = v_submission.id;

    v_effective_status := case
      when v_org.is_billing_exempt then 'exempt'
      when v_org.trial_ends_at is not null and v_org.trial_ends_at >= v_now then 'trialing'
      else 'past_due'
    end;

    update public.organizations
    set
      billing_status = v_effective_status,
      subscription_status = case
        when v_effective_status = 'trialing' then 'trialing'
        when v_effective_status = 'past_due' then 'past_due'
        else subscription_status
      end,
      billing_grace_ends_at = case
        when v_effective_status = 'past_due' then coalesce(billing_grace_ends_at, v_now + interval '3 days')
        else billing_grace_ends_at
      end
    where id = v_org.id;
  end if;

  return v_submission.id;
end;
$$;

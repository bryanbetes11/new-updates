-- ============================================================================
-- Block manual billing submissions for exempt churches
-- ----------------------------------------------------------------------------
-- Purpose:
--   * prevent MCJC or any billing-exempt tenant from creating payment
--     submissions even if the client-side guard is bypassed
-- ============================================================================

create or replace function public.prevent_exempt_org_payment_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_exempt boolean;
begin
  select is_billing_exempt
  into v_is_exempt
  from public.organizations
  where id = new.org_id;

  if coalesce(v_is_exempt, false) then
    raise exception 'Billing-exempt churches cannot submit payment records';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_exempt_org_payment_submission on public.organization_payment_submissions;
create trigger trg_prevent_exempt_org_payment_submission
  before insert on public.organization_payment_submissions
  for each row execute function public.prevent_exempt_org_payment_submission();

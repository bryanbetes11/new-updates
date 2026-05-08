-- ============================================================================
-- Manual billing foundation
-- ----------------------------------------------------------------------------
-- Purpose:
--   * support a 10-day trial for self-serve church creation
--   * track manual GCash/bank-transfer billing state per church
--   * store church payment submissions for owner review and approval
-- ============================================================================

alter table public.organizations
  add column if not exists trial_started_at timestamptz,
  add column if not exists billing_status text,
  add column if not exists billing_plan text,
  add column if not exists billing_interval text,
  add column if not exists payment_method text,
  add column if not exists current_period_start timestamptz,
  add column if not exists billing_grace_ends_at timestamptz,
  add column if not exists is_billing_exempt boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizations_billing_status_chk'
  ) then
    alter table public.organizations
      add constraint organizations_billing_status_chk
      check (billing_status in ('trialing', 'submitted', 'active', 'past_due', 'suspended', 'exempt'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizations_billing_interval_chk'
  ) then
    alter table public.organizations
      add constraint organizations_billing_interval_chk
      check (billing_interval in ('monthly', 'quarterly', 'annual', 'custom'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizations_payment_method_chk'
  ) then
    alter table public.organizations
      add constraint organizations_payment_method_chk
      check (payment_method in ('manual_gcash', 'manual_bank_transfer', 'manual_flexible'));
  end if;
end $$;

create index if not exists organizations_billing_status_idx
  on public.organizations (billing_status);

create index if not exists organizations_trial_ends_at_idx
  on public.organizations (trial_ends_at);

create index if not exists organizations_billing_plan_idx
  on public.organizations (billing_plan);

update public.organizations
set
  is_billing_exempt = true,
  billing_status = 'exempt',
  payment_method = coalesce(payment_method, 'manual_flexible')
where slug = 'mcjc-church';

update public.organizations
set
  trial_started_at = coalesce(trial_started_at, created_at),
  trial_ends_at = coalesce(trial_ends_at, created_at + interval '10 days'),
  billing_status = coalesce(
    billing_status,
    case
      when is_billing_exempt then 'exempt'
      when subscription_status = 'active' then 'active'
      when subscription_status = 'past_due' then 'past_due'
      when subscription_status in ('canceled', 'incomplete') then 'suspended'
      when coalesce(trial_ends_at, created_at + interval '10 days') >= now() then 'trialing'
      else 'past_due'
    end
  ),
  billing_interval = coalesce(billing_interval, 'monthly'),
  payment_method = coalesce(payment_method, 'manual_flexible')
where slug <> 'mcjc-church' or slug is null;

create table if not exists public.organization_payment_submissions (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organizations(id) on delete cascade,
  submitted_by      uuid not null references public.profiles(id) on delete restrict,
  plan_code         text not null,
  amount            numeric(12,2) not null check (amount > 0),
  billing_reference text not null unique default ('BILL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  payer_name        text,
  payment_channel   text not null check (payment_channel in ('gcash', 'bank_transfer')),
  reference_number  text not null,
  receipt_url       text,
  note              text,
  status            text not null default 'submitted' check (status in ('submitted', 'verified', 'rejected')),
  reviewed_by       uuid references public.profiles(id) on delete set null,
  reviewed_at       timestamptz,
  rejection_reason  text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists organization_payment_submissions_org_status_idx
  on public.organization_payment_submissions (org_id, status, created_at desc);

create index if not exists organization_payment_submissions_submitted_by_idx
  on public.organization_payment_submissions (submitted_by, created_at desc);

create index if not exists organization_payment_submissions_reference_idx
  on public.organization_payment_submissions (reference_number);

drop trigger if exists trg_org_payment_submissions_touch_updated_at on public.organization_payment_submissions;
create trigger trg_org_payment_submissions_touch_updated_at
  before update on public.organization_payment_submissions
  for each row execute function public.touch_updated_at();

create or replace function public.set_org_payment_submission_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.submitted_by is null then
    new.submitted_by := auth.uid();
  end if;

  if new.org_id is null then
    new.org_id := public.auth_org_id();
  end if;

  if new.status is null then
    new.status := 'submitted';
  end if;

  if new.billing_reference is null or trim(new.billing_reference) = '' then
    new.billing_reference := 'BILL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  end if;

  return new;
end;
$$;

drop trigger if exists trg_org_payment_submissions_defaults on public.organization_payment_submissions;
create trigger trg_org_payment_submissions_defaults
  before insert on public.organization_payment_submissions
  for each row execute function public.set_org_payment_submission_defaults();

alter table public.organization_payment_submissions enable row level security;

drop policy if exists org_payment_submissions_select_admin on public.organization_payment_submissions;
create policy org_payment_submissions_select_admin
  on public.organization_payment_submissions for select
  using (
    public.is_platform_owner()
    or (
      org_id = public.auth_org_id()
      and public.auth_is_org_admin()
    )
  );

drop policy if exists org_payment_submissions_insert_admin on public.organization_payment_submissions;
create policy org_payment_submissions_insert_admin
  on public.organization_payment_submissions for insert
  with check (
    org_id = public.auth_org_id()
    and public.auth_is_org_admin()
    and submitted_by = auth.uid()
  );

drop policy if exists org_payment_submissions_update_admin on public.organization_payment_submissions;
create policy org_payment_submissions_update_admin
  on public.organization_payment_submissions for update
  using (
    public.is_platform_owner()
    or (
      org_id = public.auth_org_id()
      and public.auth_is_org_admin()
      and status = 'submitted'
    )
  )
  with check (
    public.is_platform_owner()
    or (
      org_id = public.auth_org_id()
      and public.auth_is_org_admin()
      and status = 'submitted'
    )
  );

drop policy if exists org_payment_submissions_delete_owner on public.organization_payment_submissions;
create policy org_payment_submissions_delete_owner
  on public.organization_payment_submissions for delete
  using (public.is_platform_owner());

create or replace function public.create_organization_for_current_user(
  p_name text,
  p_slug text,
  p_logo_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_org_id uuid;
  v_slug text;
  v_now timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = auth.uid()
  limit 1;

  if v_profile.id is null then
    raise exception 'Profile not found';
  end if;

  if v_profile.org_id is not null then
    raise exception 'Account already belongs to a church';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'Church name is required';
  end if;

  v_slug := lower(trim(p_slug));

  if v_slug !~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$' then
    raise exception 'Slug must use lowercase letters, numbers, and hyphens only';
  end if;

  insert into public.organizations (
    name,
    slug,
    logo_url,
    created_by,
    subscription_status,
    billing_status,
    payment_method,
    billing_interval,
    trial_started_at,
    trial_ends_at
  ) values (
    trim(p_name),
    v_slug,
    nullif(trim(coalesce(p_logo_url, '')), ''),
    auth.uid(),
    'trialing',
    'trialing',
    'manual_flexible',
    'monthly',
    v_now,
    v_now + interval '10 days'
  )
  returning id into v_org_id;

  update public.profiles
  set
    org_id = v_org_id,
    is_org_admin = true
  where id = auth.uid();

  return v_org_id;
end;
$$;

comment on column public.organizations.subscription_status is
  'Legacy Stripe-oriented status field. Manual billing should also keep it aligned for existing UI surfaces.';

comment on column public.organizations.billing_status is
  'Primary church access/billing state for the manual-payment SaaS flow.';

comment on column public.organizations.is_billing_exempt is
  'Bypasses billing enforcement for protected tenants such as MCJC during rollout.';

comment on table public.organization_payment_submissions is
  'Manual payment submissions from church admins for GCash/bank-transfer review.';

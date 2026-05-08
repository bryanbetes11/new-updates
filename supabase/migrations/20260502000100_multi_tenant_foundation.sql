-- ============================================================================
-- Multi-tenant SaaS foundation
-- ----------------------------------------------------------------------------
-- Phase A1 of the SaaS conversion: introduces the `organizations` table that
-- becomes the tenant boundary, plus the `organization_invitations` table that
-- powers admin-driven email invites. No existing tables are touched here;
-- subsequent migrations add `org_id` columns and rewrite RLS.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---- profiles dependencies -------------------------------------------------
--
-- Add the two profile columns that the policies below depend on. The full
-- org_id retrofit across the remaining 29 tables happens in the next
-- migration (A2). org_id stays nullable here; the NOT NULL constraint is
-- applied by the backfill migration (A7) after every row has been assigned.

alter table public.profiles
  add column if not exists org_id uuid;

alter table public.profiles
  add column if not exists is_org_admin boolean not null default false;

create index if not exists profiles_org_id_idx on public.profiles (org_id);

-- ---- organizations ---------------------------------------------------------

create table if not exists public.organizations (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  slug                     text not null unique,
  logo_url                 text,
  created_by               uuid references public.profiles(id) on delete set null,

  -- Stripe linkage (populated by the create-trial-subscription edge function
  -- in Phase E; nullable so backfilled MCJC org can exist without billing).
  stripe_customer_id       text unique,
  stripe_subscription_id   text unique,
  subscription_status      text
    check (subscription_status in
      ('trialing','active','past_due','canceled','incomplete')),
  trial_ends_at            timestamptz,
  current_period_end       timestamptz,
  seats_purchased          int not null default 0,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists organizations_subscription_status_idx
  on public.organizations (subscription_status);

-- Slug format: lowercase alphanumerics + hyphens, 3..40 chars. Enforced here
-- so client-side validation cannot be bypassed.
alter table public.organizations
  add constraint organizations_slug_format_chk
  check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$');

-- updated_at touch trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_organizations_touch_updated_at on public.organizations;
create trigger trg_organizations_touch_updated_at
  before update on public.organizations
  for each row execute function public.touch_updated_at();

-- Now that organizations exists, wire up the FK from profiles.org_id.
-- ON DELETE RESTRICT: an org cannot be deleted while members reference it;
-- the application layer must remove members (or hard-delete via service role
-- in the purge job) first.
alter table public.profiles
  add constraint profiles_org_id_fkey
  foreign key (org_id) references public.organizations(id) on delete restrict;

-- ---- organization_invitations ----------------------------------------------

create table if not exists public.organization_invitations (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  email        text not null,
  -- Roles to apply on accept. Stored as uuid[] referencing roles(id);
  -- application code validates membership, no FK array constraint in postgres.
  role_ids     uuid[] not null default '{}'::uuid[],
  is_admin     boolean not null default false,
  invited_by   uuid references public.profiles(id) on delete set null,

  -- URL-safe token for invite links. UUID-derived to avoid dependency on
  -- gen_random_bytes(), which is not available on all hosted Postgres setups.
  token        text not null unique
                 default lower(replace(gen_random_uuid()::text, '-', '')),

  expires_at   timestamptz not null default (now() + interval '7 days'),
  accepted_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- Normalize email casing so duplicate-invite checks are reliable.
create or replace function public.lowercase_invitation_email()
returns trigger language plpgsql as $$
begin
  new.email := lower(trim(new.email));
  return new;
end $$;

drop trigger if exists trg_invitations_lowercase_email on public.organization_invitations;
create trigger trg_invitations_lowercase_email
  before insert or update of email on public.organization_invitations
  for each row execute function public.lowercase_invitation_email();

create index if not exists organization_invitations_org_email_idx
  on public.organization_invitations (org_id, email);

create index if not exists organization_invitations_pending_idx
  on public.organization_invitations (org_id)
  where accepted_at is null;

-- ---- Row Level Security ----------------------------------------------------
--
-- We enable RLS now and add minimally-permissive policies. The
-- `auth_org_id()` helper function and full membership-aware policies arrive
-- in the next migration (A3/A4); until then, only service-role access works
-- against these tables, which is what we want during build-out.

alter table public.organizations           enable row level security;
alter table public.organization_invitations enable row level security;

-- Authenticated users can SELECT the org they belong to. Until profiles has
-- an org_id (next migration), this policy returns no rows for everyone, which
-- is safe.
create policy organizations_select_own
  on public.organizations for select
  using (
    id = (select org_id from public.profiles where id = auth.uid())
  );

-- Org admins can update their own org. Same caveat: blocks everyone until
-- profiles.org_id is populated.
create policy organizations_update_admin
  on public.organizations for update
  using (
    id = (select org_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and is_org_admin = true
    )
  );

-- Inserts are performed by the create-trial-subscription edge function using
-- the service role key, which bypasses RLS. No public insert policy.

-- Invitation visibility: admins of the inviting org can see all rows.
-- Acceptance flow reads by token via service-role edge function; no public
-- read-by-token policy here, which is intentional (prevents token enumeration).
create policy invitations_select_admin
  on public.organization_invitations for select
  using (
    org_id = (select org_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and is_org_admin = true
    )
  );

create policy invitations_insert_admin
  on public.organization_invitations for insert
  with check (
    org_id = (select org_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and is_org_admin = true
    )
  );

create policy invitations_delete_admin
  on public.organization_invitations for delete
  using (
    org_id = (select org_id from public.profiles where id = auth.uid())
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and is_org_admin = true
    )
  );

-- ---- Comments --------------------------------------------------------------

comment on table public.organizations is
  'One row per church. Tenant boundary for the multi-tenant SaaS.';
comment on column public.organizations.slug is
  'URL-safe identifier used in invite emails and (eventually) public links.';
comment on column public.organizations.subscription_status is
  'Mirrored from Stripe via webhook. Drives BillingLocked gating.';

comment on table public.organization_invitations is
  'Pending email invitations issued by org admins. Token is single-use.';
comment on column public.organization_invitations.token is
  'URL-safe base64; embedded in invite link as /invite/<token>.';

-- ============================================================================
-- Platform-owner dashboard helpers
-- ----------------------------------------------------------------------------
-- Purpose:
--   * expose a private control-plane for the product owner
--   * allow cross-tenant reporting for churches, members, and registrations
-- ============================================================================

create or replace function public.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and lower(email) in ('bryanbetes11@gmail.com')
  );
$$;

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
    (select count(*) from public.organizations where subscription_status = 'active'),
    (select count(*) from public.organizations where subscription_status = 'trialing'),
    (select count(*) from public.organizations where subscription_status = 'past_due'),
    (select count(*) from public.organizations where subscription_status = 'canceled'),
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
    o.subscription_status,
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

create or replace function public.get_platform_recent_registrations()
returns table (
  profile_id uuid,
  email text,
  first_name text,
  created_at timestamptz,
  org_id uuid,
  org_name text,
  is_org_admin boolean,
  is_onboarded boolean
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
    p.created_at,
    p.org_id,
    o.name,
    p.is_org_admin,
    p.is_onboarded
  from public.profiles p
  left join public.organizations o on o.id = p.org_id
  where public.is_platform_owner()
  order by p.created_at desc
  limit 50;
$$;

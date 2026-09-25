-- During the private pilot, only a pre-approved, email-verified church admin
-- can create a new tenant. Existing member invitations still work unchanged.
create table if not exists private.church_pilot_invites (
  email text primary key check (email = lower(btrim(email)) and length(email) between 3 and 320),
  expires_at timestamptz not null,
  claimed_at timestamptz,
  claimed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
revoke all on private.church_pilot_invites from public, anon, authenticated;
create table if not exists private.pilot_churches (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  started_at timestamptz not null default now()
);
revoke all on private.pilot_churches from public, anon, authenticated;
alter table public.organizations add column if not exists is_private_pilot boolean not null default false;
create or replace function private.guard_pilot_billing_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.role() = 'authenticated'
    and current_setting('servesync.pilot_provisioning',true) is distinct from 'verified'
    and (old.is_private_pilot is distinct from new.is_private_pilot
      or (old.is_private_pilot and (
        old.is_billing_exempt is distinct from new.is_billing_exempt
        or old.billing_status is distinct from new.billing_status
        or old.subscription_status is distinct from new.subscription_status
        or old.billing_plan is distinct from new.billing_plan
        or old.billing_interval is distinct from new.billing_interval
        or old.payment_method is distinct from new.payment_method
        or old.trial_ends_at is distinct from new.trial_ends_at
        or old.current_period_end is distinct from new.current_period_end
        or old.billing_grace_ends_at is distinct from new.billing_grace_ends_at
        or old.seats_purchased is distinct from new.seats_purchased
      ))) then raise exception 'Pilot billing is managed by ServeSync';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_pilot_billing_update() from public,anon,authenticated;
drop trigger if exists organizations_guard_pilot_billing on public.organizations;
create trigger organizations_guard_pilot_billing before update on public.organizations
  for each row execute function private.guard_pilot_billing_update();
create table if not exists private.pilot_adult_confirmations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  confirmed_at timestamptz not null default now()
);
revoke all on private.pilot_adult_confirmations from public, anon, authenticated;
create table if not exists private.pilot_terms_acceptances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  terms_version text not null,
  accepted_at timestamptz not null default now()
);
revoke all on private.pilot_terms_acceptances from public, anon, authenticated;

create function public.accept_private_pilot_terms(p_version text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_version <> '2026-09-25' then raise exception 'Review the current pilot terms'; end if;
  insert into private.pilot_terms_acceptances(user_id,terms_version) values (auth.uid(),p_version)
    on conflict (user_id) do update set terms_version=excluded.terms_version,accepted_at=now();
end;
$$;
revoke all on function public.accept_private_pilot_terms(text) from public, anon;
grant execute on function public.accept_private_pilot_terms(text) to authenticated;

create function public.confirm_private_pilot_adult() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid()
    and (birthday is null or birthday <= (current_date - interval '18 years')::date))
  then raise exception 'The private pilot is for adults only'; end if;
  insert into private.pilot_adult_confirmations(user_id) values (auth.uid())
    on conflict (user_id) do update set confirmed_at=excluded.confirmed_at;
end;
$$;
revoke all on function public.confirm_private_pilot_adult() from public, anon;
grant execute on function public.confirm_private_pilot_adult() to authenticated;

create function public.is_private_pilot_invitation(p_token text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_invitations i
    join private.pilot_churches pilot on pilot.org_id=i.org_id
    where i.token=p_token and i.accepted_at is null and i.expires_at>now()
  );
$$;
revoke all on function public.is_private_pilot_invitation(text) from public, anon;
grant execute on function public.is_private_pilot_invitation(text) to authenticated;

-- Keep the existing, validated provisioning routine behind the invite gate.
alter function public.create_organization_for_current_user(text,text,text)
  rename to create_organization_for_approved_pilot_admin;
revoke all on function public.create_organization_for_approved_pilot_admin(text,text,text)
  from public, anon, authenticated;

create function public.create_organization_for_current_user(
  p_name text, p_slug text, p_logo_url text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
  v_invite private.church_pilot_invites%rowtype;
  v_org uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select lower(btrim(email)) into v_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
  if v_email is null then raise exception 'Confirm your email before creating a church'; end if;
  select * into v_invite from private.church_pilot_invites
    where email=v_email and expires_at>now() and claimed_at is null for update;
  if v_invite.email is null then raise exception 'A private pilot invitation is required for this church'; end if;
  if not exists (
    select 1 from public.profiles p
    join private.pilot_adult_confirmations a on a.user_id=p.id
    where p.id=auth.uid() and (p.birthday is null or p.birthday <= (current_date - interval '18 years')::date)
  ) then raise exception 'The private pilot is for adults only. Confirm your age to continue'; end if;
  if not exists(select 1 from private.pilot_terms_acceptances where user_id=auth.uid() and terms_version='2026-09-25')
    then raise exception 'Accept the private pilot terms to continue'; end if;
  v_org := public.create_organization_for_approved_pilot_admin(p_name,p_slug,p_logo_url);
  perform pg_catalog.set_config('servesync.pilot_provisioning','verified',true);
  update public.organizations set billing_status='exempt', subscription_status='active', is_billing_exempt=true,
    is_private_pilot=true,
    trial_ends_at=null, current_period_end=null where id=v_org;
  perform pg_catalog.set_config('servesync.pilot_provisioning','',true);
  update private.church_pilot_invites set claimed_at=now(),claimed_by=auth.uid() where email=v_email;
  insert into private.pilot_churches(org_id) values (v_org);
  return v_org;
end;
$$;
revoke all on function public.create_organization_for_current_user(text,text,text) from public, anon;
grant execute on function public.create_organization_for_current_user(text,text,text) to authenticated;
comment on function public.create_organization_for_current_user(text,text,text) is
  'Creates a church only for an email-verified account with an unclaimed, unexpired private pilot invite.';

alter function public.accept_organization_invitation(text)
  rename to accept_organization_invitation_checked;
revoke all on function public.accept_organization_invitation_checked(text)
  from public, anon, authenticated;
create function public.accept_organization_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select org_id into v_org from public.organization_invitations
    where token=p_token and accepted_at is null and expires_at>now();
  if v_org is null then raise exception 'Invitation is invalid or expired'; end if;
  if exists(select 1 from private.pilot_churches where org_id=v_org) and not exists (
    select 1 from public.profiles p
    join private.pilot_adult_confirmations a on a.user_id=p.id
    where p.id=auth.uid() and (p.birthday is null or p.birthday <= (current_date - interval '18 years')::date)
  ) then raise exception 'The private pilot is for adults only. Confirm your age to continue'; end if;
  if exists(select 1 from private.pilot_churches where org_id=v_org) and not exists (
    select 1 from private.pilot_terms_acceptances where user_id=auth.uid() and terms_version='2026-09-25'
  ) then raise exception 'Accept the private pilot terms to continue'; end if;
  return public.accept_organization_invitation_checked(p_token);
end;
$$;
revoke all on function public.accept_organization_invitation(text) from public, anon;
grant execute on function public.accept_organization_invitation(text) to authenticated;

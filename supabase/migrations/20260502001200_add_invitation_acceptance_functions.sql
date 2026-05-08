-- ============================================================================
-- Invitation acceptance helpers
-- ----------------------------------------------------------------------------
-- Purpose:
--   * allow public token lookup for invite landing pages
--   * allow authenticated users to safely accept an invite and join the org
-- ============================================================================

create or replace function public.get_organization_invitation_by_token(
  p_token text
)
returns table (
  invitation_id uuid,
  org_id uuid,
  org_name text,
  org_slug text,
  email text,
  role_ids uuid[],
  is_admin boolean,
  expires_at timestamptz,
  accepted_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    oi.id,
    oi.org_id,
    o.name,
    o.slug,
    oi.email,
    oi.role_ids,
    oi.is_admin,
    oi.expires_at,
    oi.accepted_at
  from public.organization_invitations oi
  join public.organizations o on o.id = oi.org_id
  where oi.token = p_token
  limit 1;
$$;

create or replace function public.accept_organization_invitation(
  p_token text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.organization_invitations%rowtype;
  v_profile public.profiles%rowtype;
  v_role_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_invite
  from public.organization_invitations
  where token = p_token
  limit 1;

  if v_invite.id is null then
    raise exception 'Invitation not found';
  end if;

  if v_invite.accepted_at is not null then
    raise exception 'Invitation already accepted';
  end if;

  if v_invite.expires_at < now() then
    raise exception 'Invitation expired';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = auth.uid()
  limit 1;

  if v_profile.id is null then
    raise exception 'Profile not found';
  end if;

  if lower(coalesce(v_profile.email, '')) != lower(coalesce(v_invite.email, '')) then
    raise exception 'Signed-in email does not match invitation email';
  end if;

  if v_profile.org_id is not null and v_profile.org_id != v_invite.org_id then
    raise exception 'Account already belongs to another church';
  end if;

  update public.profiles
  set
    org_id = v_invite.org_id,
    is_org_admin = coalesce(is_org_admin, false) or v_invite.is_admin
  where id = auth.uid();

  if array_length(v_invite.role_ids, 1) is not null then
    foreach v_role_id in array v_invite.role_ids
    loop
      insert into public.user_roles (org_id, user_id, role_id)
      select v_invite.org_id, auth.uid(), v_role_id
      where not exists (
        select 1
        from public.user_roles ur
        where ur.user_id = auth.uid()
          and ur.role_id = v_role_id
          and ur.org_id = v_invite.org_id
      );
    end loop;
  end if;

  update public.organization_invitations
  set accepted_at = now()
  where id = v_invite.id;

  return v_invite.org_id;
end;
$$;

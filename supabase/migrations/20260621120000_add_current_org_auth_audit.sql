-- Expose an org-scoped auth health check for roster managers.
-- This lets leaders distinguish real Auth users from profile-only members.

create or replace function public.get_current_org_auth_audit()
returns table (
  profile_id uuid,
  email text,
  auth_email text,
  first_name text,
  last_name text,
  nickname text,
  has_auth_user boolean,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  auth_created_at timestamptz,
  pending_invite_id uuid,
  pending_invite_token text,
  invite_expires_at timestamptz,
  invite_accepted_at timestamptz,
  auth_status text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_org_id uuid;
  v_can_manage boolean;
begin
  select
    p.org_id,
    (
      coalesce(p.is_org_admin, false)
      or exists (
        select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = auth.uid()
          and ur.org_id = p.org_id
          and r.name in ('Admin', 'Production Director')
      )
    )
  into v_org_id, v_can_manage
  from public.profiles p
  where p.id = auth.uid();

  if v_org_id is null or not coalesce(v_can_manage, false) then
    raise exception 'Not authorized';
  end if;

  return query
    select
      p.id as profile_id,
      p.email,
      au.email as auth_email,
      p.first_name,
      p.last_name,
      p.nickname,
      au.id is not null as has_auth_user,
      au.email_confirmed_at,
      au.last_sign_in_at,
      au.created_at as auth_created_at,
      pending_invite.id as pending_invite_id,
      pending_invite.token as pending_invite_token,
      pending_invite.expires_at as invite_expires_at,
      pending_invite.accepted_at as invite_accepted_at,
      case
        when au.id is null and pending_invite.id is not null and pending_invite.expires_at >= now()
          then 'invite_pending'
        when au.id is null
          then 'missing_auth_account'
        when lower(coalesce(au.email, '')) <> lower(coalesce(p.email, ''))
          then 'email_mismatch'
        when au.email_confirmed_at is null
          then 'email_unconfirmed'
        else 'ready'
      end as auth_status
    from public.profiles p
    left join auth.users au on au.id = p.id
    left join lateral (
      select oi.id, oi.token, oi.expires_at, oi.accepted_at
      from public.organization_invitations oi
      where oi.org_id = p.org_id
        and lower(oi.email) = lower(p.email)
        and oi.accepted_at is null
      order by oi.created_at desc
      limit 1
    ) pending_invite on true
    where p.org_id = v_org_id
    order by p.first_name, p.last_name, p.email;
end;
$$;

grant execute on function public.get_current_org_auth_audit() to authenticated;

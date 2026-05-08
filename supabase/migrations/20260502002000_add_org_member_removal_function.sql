-- ============================================================================
-- Church admin member removal
-- ----------------------------------------------------------------------------
-- Purpose:
--   * let org admins / permitted org managers remove a member from their church
--   * keep the auth account intact, but detach the member from the tenant
-- ============================================================================

create or replace function public.remove_member_from_current_org(
  p_member_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_org_id uuid := public.auth_org_id();
begin
  if v_actor_id is null then
    raise exception 'Authentication required';
  end if;

  if v_org_id is null then
    raise exception 'Organization context required';
  end if;

  if not public.auth_can_manage_org_profiles() then
    raise exception 'Insufficient permissions';
  end if;

  if p_member_id = v_actor_id then
    raise exception 'You cannot remove your own account from the church';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = p_member_id
      and org_id = v_org_id
  ) then
    raise exception 'Member not found in your church';
  end if;

  delete from public.user_roles
  where user_id = p_member_id
    and org_id = v_org_id;

  update public.profiles
  set
    org_id = null,
    is_org_admin = false,
    updated_at = now()
  where id = p_member_id
    and org_id = v_org_id;

  return p_member_id;
end;
$$;

-- ============================================================================
-- Create-church onboarding helper
-- ----------------------------------------------------------------------------
-- Purpose:
--   * allow an authenticated user with no org yet to create a church
--   * attach that user to the new org as its first org admin
-- ============================================================================

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
    created_by
  ) values (
    trim(p_name),
    v_slug,
    nullif(trim(coalesce(p_logo_url, '')), ''),
    auth.uid()
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

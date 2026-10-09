-- Keep self-service profile editing, but reserve ministry status changes for
-- the same church's existing profile managers. Do not grant table-wide UPDATE.
create or replace function public.guard_profile_ministry_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Trusted database maintenance retains its existing access.
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if auth.uid() is null
    or old.org_id is distinct from public.auth_org_id()
    or new.org_id is distinct from old.org_id
    or not coalesce(public.auth_can_manage_org_profiles(), false)
  then
    raise exception 'Only church profile managers can change ministry status'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_profile_ministry_status() from public, anon, authenticated;

create trigger guard_profile_ministry_status
before update of ministry_status on public.profiles
for each row
when (old.ministry_status is distinct from new.ministry_status)
execute function public.guard_profile_ministry_status();

grant update (ministry_status) on public.profiles to authenticated;

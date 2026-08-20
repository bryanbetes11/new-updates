/*
  Keep admin song-title cleanup compatible with normal authenticated sessions.

  The trigger must not call helpers through the protected private schema because
  browser sessions intentionally have no schema usage there. Check the optional
  Admin role through same-organization public membership tables instead.
*/

create or replace function public.guard_song_updates()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_can_manage_title boolean := false;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if old.created_by = v_user_id then
    return new;
  end if;

  v_can_manage_title :=
    old.org_id = public.auth_org_id()
    and (
      coalesce(public.auth_is_org_admin(), false)
      or coalesce(public.is_platform_owner(), false)
      or exists (
        select 1
        from public.user_roles user_role
        join public.roles role on role.id = user_role.role_id
        where user_role.user_id = v_user_id
          and user_role.org_id = old.org_id
          and role.name = 'Admin'
      )
    );

  if
    (new.title is distinct from old.title and not v_can_manage_title) or
    new.duration is distinct from old.duration or
    new.created_by is distinct from old.created_by or
    new.created_at is distinct from old.created_at or
    new.org_id is distinct from old.org_id
  then
    raise exception 'Only same-organization administrators can rename songs created by other users';
  end if;

  return new;
end;
$$;

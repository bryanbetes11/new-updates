/*
  Allow administrators to rename same-organization songs during library cleanup.

  Shared artist, video, lyrics, chord-chart, and song-key updates remain available
  to authenticated members. Only the creator or a same-organization administrator
  may change a song title. Ownership and tenant fields remain protected.
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
      or coalesce(private.has_named_role(v_user_id, 'Admin'), false)
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

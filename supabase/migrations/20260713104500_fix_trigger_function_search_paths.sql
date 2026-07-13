-- Pin trigger-function name resolution to trusted schemas.
alter function public.set_updated_at()
  set search_path = pg_catalog, public;

alter function public.touch_updated_at()
  set search_path = pg_catalog, public;

alter function public.lowercase_invitation_email()
  set search_path = pg_catalog, public;

alter function public.guard_song_updates()
  set search_path = pg_catalog, public;

alter function public.guard_message_metadata_update()
  set search_path = pg_catalog, public;

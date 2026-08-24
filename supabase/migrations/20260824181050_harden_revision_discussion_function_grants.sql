revoke all on function public.can_access_setlist_revision_discussion(uuid)
  from public, anon;
grant execute on function public.can_access_setlist_revision_discussion(uuid)
  to authenticated;

revoke all on function public.prepare_setlist_revision_comment()
  from public, anon, authenticated;

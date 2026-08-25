-- Trigger functions are invoked by PostgreSQL triggers, never through the
-- Data API. Remove the default PUBLIC execute grant so they cannot be called
-- as exposed RPC endpoints.

revoke all on function public.apply_leave_and_swap_policy() from public, anon, authenticated;
revoke all on function public.guard_message_metadata_update() from public, anon, authenticated;
revoke all on function public.guard_song_updates() from public, anon, authenticated;
revoke all on function public.lowercase_invitation_email() from public, anon, authenticated;
revoke all on function public.on_message_created() from public, anon, authenticated;
revoke all on function public.prepare_post_event_observation_reply() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.touch_connected_workspace_updated_at() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

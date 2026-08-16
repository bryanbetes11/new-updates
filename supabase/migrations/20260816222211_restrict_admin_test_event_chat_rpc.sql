-- Supabase may grant function execution directly to API roles through default
-- privileges. Keep this administrative RPC unavailable to anonymous callers.

revoke all on function public.create_admin_test_event_conversation(uuid) from public;
revoke all on function public.create_admin_test_event_conversation(uuid) from anon;
grant execute on function public.create_admin_test_event_conversation(uuid) to authenticated;

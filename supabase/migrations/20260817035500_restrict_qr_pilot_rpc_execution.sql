-- PostgreSQL grants function EXECUTE to PUBLIC by default. Remove that
-- inherited grant so the pilot RPC surface is authenticated-only before its
-- stricter organization-admin assertion runs.
revoke all on function public.get_qr_attendance_pilot_admin_state() from public, anon;
revoke all on function public.create_qr_attendance_pilot_event(text, timestamptz, timestamptz) from public, anon;
revoke all on function public.validate_qr_attendance_pilot_checkpoint(uuid) from public, anon;
revoke all on function public.record_qr_attendance_pilot_checkin(uuid, uuid) from public, anon;

grant execute on function public.get_qr_attendance_pilot_admin_state() to authenticated;
grant execute on function public.create_qr_attendance_pilot_event(text, timestamptz, timestamptz) to authenticated;
grant execute on function public.validate_qr_attendance_pilot_checkpoint(uuid) to authenticated;
grant execute on function public.record_qr_attendance_pilot_checkin(uuid, uuid) to authenticated;

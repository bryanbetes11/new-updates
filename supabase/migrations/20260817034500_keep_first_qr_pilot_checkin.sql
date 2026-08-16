-- A repeated pilot scan is idempotent: keep the original outcome and time.
create or replace function public.record_qr_attendance_pilot_checkin(
  p_token uuid,
  p_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid := public.assert_qr_attendance_pilot_admin();
  v_event public.attendance_qr_pilot_events%rowtype;
  v_status text;
  v_checked_in_at timestamptz;
begin
  if not exists (
    select 1 from public.attendance_qr_pilot_checkpoints checkpoint
    where checkpoint.org_id = v_org_id
      and checkpoint.token = p_token
      and checkpoint.active = true
  ) then
    raise exception 'Scan the active ServeSync attendance QR code first';
  end if;

  select * into v_event
  from public.attendance_qr_pilot_events event
  where event.id = p_event_id
    and event.org_id = v_org_id
    and event.active = true;

  if not found or now() not between v_event.starts_at - interval '30 minutes' and v_event.ends_at then
    raise exception 'This pilot event is not currently accepting attendance';
  end if;

  v_status := case when now() <= v_event.starts_at + interval '5 minutes' then 'present' else 'late' end;

  insert into public.attendance_qr_pilot_checkins (
    org_id, pilot_event_id, user_id, status
  ) values (
    v_org_id, v_event.id, auth.uid(), v_status
  )
  on conflict (pilot_event_id, user_id) do update
    set status = public.attendance_qr_pilot_checkins.status
  returning status, checked_in_at into v_status, v_checked_in_at;

  return jsonb_build_object(
    'event_id', v_event.id,
    'event_title', v_event.title,
    'status', v_status,
    'checked_in_at', v_checked_in_at,
    'pilot_only', true
  );
end;
$$;

revoke all on function public.record_qr_attendance_pilot_checkin(uuid, uuid) from public, anon;
grant execute on function public.record_qr_attendance_pilot_checkin(uuid, uuid) to authenticated;

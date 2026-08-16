-- Keep the live QR useful before an attendance window opens. The member still
-- receives a five-minute, one-use scan session, but the response now includes
-- their next five non-declined assignments. Future assignments are
-- informational only; record_qr_attendance_checkin continues to enforce the
-- same-day, 30-minute opening rule on the server.
create or replace function public.validate_qr_attendance_checkpoint(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
  v_session_id uuid;
  v_expires_at timestamptz;
  v_today date := timezone('Asia/Manila', now())::date;
begin
  if auth.uid() is null then raise exception 'Sign in to scan attendance'; end if;
  v_org_id := public.auth_org_id();
  if v_org_id is null then raise exception 'No organization selected'; end if;

  if not exists (
    select 1
    from public.attendance_qr_checkpoints checkpoint
    where checkpoint.org_id = v_org_id
      and checkpoint.token = p_token
      and checkpoint.active
  ) then
    raise exception 'This attendance QR is not active for your church';
  end if;

  delete from public.attendance_qr_scan_sessions
  where user_id = auth.uid()
    and expires_at < now() - interval '1 day';

  v_expires_at := now() + interval '5 minutes';
  insert into public.attendance_qr_scan_sessions(
    org_id, user_id, checkpoint_org_id, expires_at
  ) values (
    v_org_id, auth.uid(), v_org_id, v_expires_at
  ) returning id into v_session_id;

  return jsonb_build_object(
    'session_token', v_session_id,
    'expires_at', v_expires_at,
    'events', coalesce((
      select jsonb_agg(event_row order by event_row.starts_at, event_row.title)
      from (
        select scheduled.*
        from (
          select distinct on (event.id)
            event.id,
            event.title,
            ((event.event_date + event.start_time) at time zone 'Asia/Manila') as starts_at,
            case
              when event.end_time is not null
                then ((event.event_date + event.end_time) at time zone 'Asia/Manila')
              else ((event.event_date + event.start_time) at time zone 'Asia/Manila') + interval '6 hours'
            end as ends_at,
            ((event.event_date + event.start_time) at time zone 'Asia/Manila') - interval '30 minutes' as opens_at,
            (
              event.event_date = v_today
              and now() >= ((event.event_date + event.start_time) at time zone 'Asia/Manila') - interval '30 minutes'
            ) as attendance_open,
            attendance.status as existing_status,
            attendance.checked_in_at
          from public.events event
          join public.event_assignments assignment
            on assignment.event_id = event.id
           and assignment.org_id = v_org_id
           and assignment.user_id = auth.uid()
           and assignment.status <> 'declined'
          left join public.event_attendance attendance
            on attendance.event_id = event.id
           and attendance.user_id = auth.uid()
           and attendance.org_id = v_org_id
          where event.org_id = v_org_id
            and event.event_date >= v_today
          order by event.id, assignment.created_at, assignment.id
        ) scheduled
        order by scheduled.starts_at, scheduled.title
        limit 5
      ) event_row
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.validate_qr_attendance_checkpoint(uuid) from public, anon;
grant execute on function public.validate_qr_attendance_checkpoint(uuid) to authenticated;

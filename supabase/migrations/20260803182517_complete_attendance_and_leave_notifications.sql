-- Complete notification producers discovered during the notification catalog audit.

create or replace function private.notify_leave_response()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_decision text := case when new.status = 'approved' then 'approved' else 'declined' end;
  v_date_label text;
  v_body text;
begin
  if coalesce(new.request_type, 'leave') <> 'leave'
    or new.status not in ('approved', 'rejected')
    or old.status is not distinct from new.status then
    return new;
  end if;

  v_date_label := case
    when new.leave_type = 'range' and new.start_date is not null and new.end_date is not null
      then to_char(new.start_date, 'FMMonth FMDD, YYYY') || ' to ' || to_char(new.end_date, 'FMMonth FMDD, YYYY')
    when new.unavailable_date is not null
      then to_char(new.unavailable_date, 'FMMonth FMDD, YYYY')
    when new.start_date is not null
      then to_char(new.start_date, 'FMMonth FMDD, YYYY')
    else 'your requested date'
  end;

  v_body := 'Your unavailable day request for ' || v_date_label || ' was ' || v_decision || '.';
  if nullif(btrim(new.approval_notes), '') is not null then
    v_body := v_body || ' Note: ' || btrim(new.approval_notes);
  end if;

  perform public.create_notification(
    new.user_id,
    'leave_response',
    'Unavailable Day ' || initcap(v_decision),
    v_body,
    jsonb_build_object(
      'leave_id', new.id::text,
      'status', new.status,
      'date', v_date_label,
      'url', '/leave',
      'dedupe_key', 'leave-response:' || new.id::text || ':' || new.status
    )
  );

  return new;
end;
$$;

drop trigger if exists user_availability_create_leave_response_notification on public.user_availability;
create trigger user_availability_create_leave_response_notification
after update of status on public.user_availability
for each row execute function private.notify_leave_response();

revoke all on function private.notify_leave_response() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname in (
    'check-attendance-remind',
    'check-attendance-missed-evening',
    'check-attendance-missed-final'
  );

  perform cron.schedule(
    'check-attendance-remind',
    '0 1 * * *',
    $job$
      with config as (
        select decrypted_secret as webhook_secret
        from vault.decrypted_secrets
        where name = 'attendance_cron_secret'
      )
      select net.http_post(
        url := 'https://uhwkrxihyqkagirdjhht.supabase.co/functions/v1/check-attendance?action=remind',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-internal-secret', webhook_secret
        ),
        body := '{}'::jsonb
      )
      from config;
    $job$
  );

  perform cron.schedule(
    'check-attendance-missed-evening',
    '0 11 * * *',
    $job$
      with config as (
        select decrypted_secret as webhook_secret
        from vault.decrypted_secrets
        where name = 'attendance_cron_secret'
      )
      select net.http_post(
        url := 'https://uhwkrxihyqkagirdjhht.supabase.co/functions/v1/check-attendance?action=missed_evening',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-internal-secret', webhook_secret
        ),
        body := '{}'::jsonb
      )
      from config;
    $job$
  );

  perform cron.schedule(
    'check-attendance-missed-final',
    '0 11 * * *',
    $job$
      with config as (
        select decrypted_secret as webhook_secret
        from vault.decrypted_secrets
        where name = 'attendance_cron_secret'
      )
      select net.http_post(
        url := 'https://uhwkrxihyqkagirdjhht.supabase.co/functions/v1/check-attendance?action=missed_final',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-internal-secret', webhook_secret
        ),
        body := '{}'::jsonb
      )
      from config;
    $job$
  );
end;
$$;

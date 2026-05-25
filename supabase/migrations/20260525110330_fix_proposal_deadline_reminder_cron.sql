/*
  # Fix proposal deadline reminder cron timing

  The check-proposal-deadlines function only sends during Manila reminder slots:
  9:00 AM, 1:00 PM, and 7:00 PM. The previous every-6-hours schedule could run
  at 8:00 AM, 2:00 PM, and 8:00 PM Manila time, which misses every slot.

  This reschedules the job to the exact UTC hours for those Manila slots:
  - 01:00 UTC = 09:00 PHT
  - 05:00 UTC = 13:00 PHT
  - 11:00 UTC = 19:00 PHT
*/

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;

do $$
begin
  perform cron.unschedule('check-proposal-deadlines');
exception
  when others then
    null;
end $$;

select cron.schedule(
  'check-proposal-deadlines',
  '0 1,5,11 * * *',
  $$
  with config as (
    select
      coalesce(
        nullif(current_setting('app.settings.supabase_url', true), ''),
        'https://uhwkrxihyqkagirdjhht.supabase.co'
      ) as function_base_url,
      coalesce(
        nullif(current_setting('app.settings.service_role_key', true), ''),
        nullif(current_setting('app.settings.supabase_service_role_key', true), '')
      ) as service_role_key
  )
  select net.http_post(
    url := function_base_url || '/functions/v1/check-proposal-deadlines?cron_key=proposal-reminders-cron-2026-05-04',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key,
      'apikey', service_role_key
    ),
    body := '{}'::jsonb
  )
  from config;
  $$
);

/*
  # Schedule Cron Jobs for Event Reminders and Attendance

  1. Cron Jobs Created
    - Day-before reminder: 9:00 PM Philippine time (13:00 UTC) daily
    - Day-of reminder: 7:00 AM Philippine time (23:00 UTC previous day) daily
    - Attendance reminder: 8:00 PM Philippine time (12:00 UTC) daily
    - Auto-mark absent: 12:05 AM Philippine time (16:05 UTC previous day) daily

  2. Schedule Details
    - Philippine time = UTC+8
    - 9:00 PM PHT = 13:00 UTC
    - 7:00 AM PHT = 23:00 UTC (previous day)
    - 8:00 PM PHT = 12:00 UTC
    - 12:05 AM PHT = 16:05 UTC (previous day)

  3. Important Notes
    - Uses pg_cron extension (already enabled)
    - Uses pg_net for HTTP requests (already enabled)
*/

-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Grant usage to postgres
GRANT USAGE ON SCHEMA cron TO postgres;

-- Remove existing jobs if they exist (to prevent duplicates)
DO $$
BEGIN
  PERFORM cron.unschedule('check-event-reminders-day-before');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('check-event-reminders-day-of');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('check-attendance-reminder');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('check-attendance-mark-absent');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Schedule day-before reminder at 9:00 PM Philippine time (13:00 UTC)
SELECT cron.schedule(
  'check-event-reminders-day-before',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/check-event-reminders?type=day_before',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Schedule day-of reminder at 7:00 AM Philippine time (23:00 UTC previous day)
SELECT cron.schedule(
  'check-event-reminders-day-of',
  '0 23 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/check-event-reminders?type=day_of',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Schedule attendance reminder at 8:00 PM Philippine time (12:00 UTC)
SELECT cron.schedule(
  'check-attendance-reminder',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/check-attendance?action=remind',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Schedule auto-mark absent at 12:05 AM Philippine time (16:05 UTC previous day)
SELECT cron.schedule(
  'check-attendance-mark-absent',
  '5 16 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/check-attendance?action=mark_absent',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

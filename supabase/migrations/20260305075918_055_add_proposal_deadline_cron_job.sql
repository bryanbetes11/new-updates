/*
  # Add Proposal Deadline Reminder System

  1. Changes
    - Creates pg_cron extension for scheduled jobs
    - Schedules a cron job to check proposal deadlines every 6 hours
    - The job calls the check-proposal-deadlines edge function

  2. Security
    - Uses pg_net extension to make HTTP requests
    - Runs with appropriate permissions

  3. Notes
    - The cron job runs at: 00:00, 06:00, 12:00, 18:00 UTC daily
    - Sends reminders for:
      - 3 days before due date
      - 1 day before due date
      - 6 hours before due date
      - Immediately when overdue
      - 1 day overdue
      - 3 days overdue
      - 7 days overdue
    - Only sends one reminder per 12-hour period to avoid spam
*/

-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a cron job that runs every 6 hours to check proposal deadlines
-- Runs at 00:00, 06:00, 12:00, 18:00 UTC daily
DO $$
BEGIN
  -- First, try to unschedule any existing job with the same name
  PERFORM cron.unschedule('check-proposal-deadlines');
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore error if job doesn't exist
    NULL;
END $$;

-- Schedule the new job
SELECT cron.schedule(
  'check-proposal-deadlines',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/check-proposal-deadlines',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Store Supabase URL and service role key in settings for the cron job
-- Note: These are set automatically by Supabase in the hosted environment
DO $$
BEGIN
  PERFORM set_config('app.settings.supabase_url', current_setting('SUPABASE_URL', true), false);
  PERFORM set_config('app.settings.supabase_service_role_key', current_setting('SUPABASE_SERVICE_ROLE_KEY', true), false);
EXCEPTION
  WHEN OTHERS THEN
    -- Settings will be available in production
    NULL;
END $$;

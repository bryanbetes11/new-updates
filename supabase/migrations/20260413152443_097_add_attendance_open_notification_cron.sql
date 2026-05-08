/*
  # Add attendance-open notification cron job

  1. Changes
    - Adds a new cron job that fires at 7:00 AM Philippine Time (23:00 UTC previous day)
      to send "Attendance is Now Open" notifications to all scheduled users for today's events.
    - This reuses the existing check-attendance edge function with the new action=notify_open.

  2. Notes
    - Scheduled users only — only members assigned to an event receive this notification.
    - Duplicate-safe — the function checks for existing notifications before inserting.
    - Runs at the same time as the existing day-of event reminder.
*/

DO $$
BEGIN
  PERFORM cron.unschedule('check-attendance-notify-open');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'check-attendance-notify-open',
  '0 23 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/check-attendance?action=notify_open',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

/*
  # Schedule minute-based attendance reminders

  1. Changes
    - Replaces the old once-per-day attendance reminder job with a minute-based job.
    - Replaces the old 7:00 AM attendance-open job with the same minute-based job.
    - Keeps auto-mark-absent intact.

  2. Reminder moments handled inside the edge function
    - 30 minutes before event start: attendance opens
    - 5 minutes before event start: reminder if still not marked
    - 4 minutes after event start: final reminder before the 5-minute grace period ends
*/

DO $$
BEGIN
  PERFORM cron.unschedule('check-attendance-notify-open');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('check-attendance-reminder');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('check-attendance-timed-reminders');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'check-attendance-timed-reminders',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/check-attendance?action=timed_reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

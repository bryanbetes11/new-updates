/*
  # Increase Push Notification Timeout

  1. Problem
    - HTTP requests to edge function are timing out after 5 seconds
    - Edge function may take longer to send push notifications
    - Need to increase timeout for pg_net requests

  2. Solution
    - Increase timeout to 30 seconds
    - Add timeout parameter to http_post call
    - Keep request async so it doesn't block notification creation

  3. Changes
    - Update trigger function with timeout_milliseconds parameter
*/

-- Update trigger function with longer timeout
DROP FUNCTION IF EXISTS trigger_push_notification() CASCADE;

CREATE OR REPLACE FUNCTION trigger_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id bigint;
BEGIN
  -- Make async HTTP request to edge function with 30 second timeout
  SELECT net.http_post(
    url := 'https://uhwkrxihyqkagirdjhht.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id::text,
      'title', NEW.title,
      'body', NEW.body,
      'data', COALESCE(NEW.data, '{}'::jsonb)
    ),
    timeout_milliseconds := 30000
  ) INTO v_request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the notification insert
    RAISE WARNING 'Push notification request failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS trg_send_push_notification ON notifications;

CREATE TRIGGER trg_send_push_notification
  AFTER INSERT ON notifications
  FOR EACH ROW
  WHEN (NEW.is_read = false)
  EXECUTE FUNCTION trigger_push_notification();

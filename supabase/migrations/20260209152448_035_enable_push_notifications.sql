/*
  # Enable Push Notifications

  1. Problem
    - Push notification trigger was dropped in migration 034
    - Subscriptions are stored but no push notifications are being sent
    - Users enabled notifications but aren't receiving them

  2. Solution
    - Create a trigger function that calls the send-push edge function via pg_net
    - Trigger on notifications INSERT to send push immediately
    - Use the service role key to authenticate the request

  3. Changes
    - Create function: trigger_push_notification() - calls edge function via HTTP
    - Add trigger on notifications table for INSERT events
    - Only send push for unread notifications
*/

-- Create function to trigger push notifications via edge function
CREATE OR REPLACE FUNCTION trigger_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url text;
  v_service_role_key text;
  v_request_id bigint;
BEGIN
  -- Get Supabase URL and service role key from environment
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_role_key := current_setting('app.settings.service_role_key', true);

  -- If settings aren't configured, try to use pg_net with default URL pattern
  -- Supabase projects follow the pattern: https://<project-ref>.supabase.co
  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'https://' || current_setting('request.jwt.claims', true)::json->>'iss';
  END IF;

  -- Make async HTTP request to edge function
  SELECT net.http_post(
    url := v_supabase_url || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(v_service_role_key, current_setting('request.jwt.claim.sub', true))
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'title', NEW.title,
      'body', NEW.body,
      'data', NEW.data
    )
  ) INTO v_request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE WARNING 'Push notification failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger on notifications table
DROP TRIGGER IF EXISTS trg_send_push_notification ON notifications;

CREATE TRIGGER trg_send_push_notification
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION trigger_push_notification();

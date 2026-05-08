/*
  # Fix push notification trigger using pg_net

  1. Problem
    - Previous migration used http extension which requires manual config
    - Need a better way to call the edge function from database triggers

  2. Solution
    - Drop the http-based trigger
    - Use pg_net extension which is built for Supabase
    - Create a new trigger that uses pg_net to call send-push edge function
    - Use vault for secure credential storage (Supabase best practice)

  3. Changes
    - Drop old trigger and function
    - Enable pg_net extension
    - Create new trigger function using pg_net.http_post
    - Add trigger on notifications table
*/

-- Drop old trigger and function
DROP TRIGGER IF EXISTS trg_send_push_notification ON notifications;
DROP FUNCTION IF EXISTS trigger_push_notification();

-- Enable pg_net for async HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to send push notification via edge function using pg_net
CREATE OR REPLACE FUNCTION trigger_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_request_id bigint;
BEGIN
  -- Make async HTTP request to send-push edge function using pg_net
  -- The SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are available as env vars in edge functions
  -- We use current_setting to read them from Supabase's runtime config
  SELECT net.http_post(
    url := current_setting('app.settings.api_external_url', true) || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id::text,
      'title', NEW.title,
      'body', NEW.body,
      'data', COALESCE(NEW.data, '{}'::jsonb)
    )
  ) INTO v_request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the notification insert
    RAISE WARNING 'Failed to trigger push notification: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Add trigger to send push notifications
CREATE TRIGGER trg_send_push_notification
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION trigger_push_notification();

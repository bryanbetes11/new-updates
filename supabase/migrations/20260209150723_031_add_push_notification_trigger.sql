/*
  # Add push notification trigger

  1. Problem
    - Notifications are being created in the database but no push notifications are being sent
    - The send-push edge function exists but is never being called

  2. Solution
    - Enable the http extension to make HTTP requests from the database
    - Create a trigger function that calls the send-push edge function when a new notification is created
    - Add a trigger on the notifications table to invoke this function

  3. Changes
    - Enable http extension
    - Create function: trigger_push_notification() - calls the send-push edge function
    - Add trigger on notifications table for INSERT events
*/

-- Enable http extension for making HTTP requests
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Function to send push notification via edge function
CREATE OR REPLACE FUNCTION trigger_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id bigint;
  v_supabase_url text;
  v_service_role_key text;
BEGIN
  -- Get environment variables
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_role_key := current_setting('app.settings.service_role_key', true);

  -- If env vars not set, try to use known values (this is a fallback)
  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
    -- Skip push notification if we can't get the config
    RETURN NEW;
  END IF;

  -- Make async HTTP request to send-push edge function
  SELECT extensions.http_post(
    url := v_supabase_url || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
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
    -- Don't fail the notification insert if push fails
    RETURN NEW;
END;
$$;

-- Add trigger to send push notifications
DROP TRIGGER IF EXISTS trg_send_push_notification ON notifications;

CREATE TRIGGER trg_send_push_notification
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION trigger_push_notification();

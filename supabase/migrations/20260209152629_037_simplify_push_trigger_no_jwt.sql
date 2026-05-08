/*
  # Simplify Push Notification Trigger

  1. Problem
    - Edge function now has verify_jwt set to false
    - No need to use service role key from vault
    - Can make direct HTTP calls from trigger

  2. Solution
    - Simplify trigger to make HTTP POST without authentication
    - Edge function handles authorization internally using service role
    - Removes dependency on vault configuration

  3. Changes
    - Update trigger function to remove authentication requirement
    - Keep the rest of the logic the same
*/

-- Drop and recreate the trigger function without vault dependency
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
  -- Make async HTTP request to edge function
  -- No authentication needed since verify_jwt is false
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
    )
  ) INTO v_request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the notification insert
    RAISE WARNING 'Push notification request failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate trigger on notifications table
DROP TRIGGER IF EXISTS trg_send_push_notification ON notifications;

CREATE TRIGGER trg_send_push_notification
  AFTER INSERT ON notifications
  FOR EACH ROW
  WHEN (NEW.is_read = false)
  EXECUTE FUNCTION trigger_push_notification();

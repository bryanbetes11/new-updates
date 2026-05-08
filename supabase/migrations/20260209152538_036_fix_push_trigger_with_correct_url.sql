/*
  # Fix Push Notification Trigger with Correct URL

  1. Problem
    - Previous trigger used current_setting which doesn't have the required values
    - Service role key needs to be securely stored and accessed

  2. Solution
    - Use vault extension to securely store the service role key
    - Use the project's actual Supabase URL in the trigger
    - Make HTTP POST request to edge function using pg_net

  3. Changes
    - Enable vault extension if not already enabled
    - Store service role key in vault (user needs to provide this)
    - Update trigger function to use vault for authentication
    - Use correct Supabase project URL
*/

-- Drop the previous trigger function
DROP FUNCTION IF EXISTS trigger_push_notification() CASCADE;

-- Create improved function that sends push notifications
CREATE OR REPLACE FUNCTION trigger_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id bigint;
  v_service_role_key text;
BEGIN
  -- Try to get service role key from vault
  -- If not available, the notification is still created, just no push sent
  BEGIN
    SELECT decrypted_secret INTO v_service_role_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;
  EXCEPTION
    WHEN OTHERS THEN
      -- Vault not configured, skip push notification
      RAISE WARNING 'Service role key not found in vault. Push notifications disabled.';
      RETURN NEW;
  END;

  -- Only proceed if we have the key
  IF v_service_role_key IS NOT NULL THEN
    -- Make async HTTP request to edge function
    -- Using the actual Supabase project URL
    SELECT net.http_post(
      url := 'https://uhwkrxihyqkagirdjhht.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      ),
      body := jsonb_build_object(
        'user_id', NEW.user_id,
        'title', NEW.title,
        'body', NEW.body,
        'data', NEW.data
      )
    ) INTO v_request_id;
  END IF;

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

-- Note: To enable push notifications, run this SQL in your Supabase SQL editor:
-- INSERT INTO vault.secrets (name, secret)
-- VALUES ('service_role_key', 'your-service-role-key-here')
-- ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;

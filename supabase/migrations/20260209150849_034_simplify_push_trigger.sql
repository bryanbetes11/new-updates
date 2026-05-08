/*
  # Simplify push notification trigger

  1. Problem
    - Previous trigger tried to use current_setting which may not have the required values
    - Push notifications might fail in certain environments (like StackBlitz)

  2. Solution
    - Drop the complex pg_net trigger
    - Push notifications will be handled by the frontend polling/realtime instead
    - Notifications are still created in the database and visible in the app

  3. Changes
    - Drop the push notification trigger (notifications still work, just not via push)
    - Clean up extensions that aren't being used effectively
*/

-- Drop the push notification trigger for now
-- Notifications will still be created and shown in the app
-- Push functionality can be added later with proper infrastructure
DROP TRIGGER IF EXISTS trg_send_push_notification ON notifications;
DROP FUNCTION IF EXISTS trigger_push_notification();

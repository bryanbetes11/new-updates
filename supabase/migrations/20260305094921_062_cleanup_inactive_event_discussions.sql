/*
  # Cleanup Inactive Event Discussions

  1. New Function
    - `cleanup_inactive_event_discussions()` - Deletes event conversations with no messages in the last 5 days
  
  2. Cron Job
    - Runs daily at 2 AM to clean up stale event discussions
    - Only affects event-type conversations
    - Conversations are deleted if their last message (or creation) was more than 5 days ago
  
  3. Notes
    - Personal and group chats are not affected
    - Event conversations without any messages will be deleted after 5 days of creation
    - This keeps the chat list clean and relevant
*/

-- Function to cleanup inactive event discussions
CREATE OR REPLACE FUNCTION cleanup_inactive_event_discussions()
RETURNS void AS $$
BEGIN
  -- Delete event conversations that have been inactive for more than 5 days
  DELETE FROM conversations
  WHERE type = 'event'
  AND updated_at < now() - interval '5 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule cron job to run daily at 2 AM
SELECT cron.schedule(
  'cleanup-inactive-event-discussions',
  '0 2 * * *',
  $$SELECT cleanup_inactive_event_discussions()$$
);

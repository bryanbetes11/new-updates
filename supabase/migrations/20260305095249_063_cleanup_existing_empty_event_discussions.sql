/*
  # Cleanup Existing Empty Event Discussions

  1. Changes
    - Removes all existing event-type conversations that have no messages
    - This is a one-time cleanup for discussions created before the new behavior
  
  2. Notes
    - Only affects event conversations with zero messages
    - Personal and group chats are not affected
    - Event discussions with existing messages are preserved
*/

-- Delete event conversations that have no messages
DELETE FROM conversations
WHERE type = 'event'
AND id NOT IN (
  SELECT DISTINCT conversation_id 
  FROM messages
);

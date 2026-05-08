/*
  # Remove Automatic Event Conversation Creation

  1. Changes
    - Drops the trigger that automatically creates event conversations when events are created
    - Event discussions will now only be created manually when users click the Discussion button
    - Keeps the trigger that adds newly assigned users to existing event conversations
  
  2. Notes
    - Existing event conversations are not affected
    - The `add_assigned_user_to_event_chat()` trigger remains active for when users are assigned
*/

-- Drop the trigger
DROP TRIGGER IF EXISTS on_event_create_conversation ON events;

-- Drop the function
DROP FUNCTION IF EXISTS create_event_conversation();

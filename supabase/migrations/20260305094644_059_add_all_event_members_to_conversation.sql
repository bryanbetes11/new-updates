/*
  # Add All Event Members to Conversation on Creation

  1. Changes
    - Updates the `create_event_conversation()` function to automatically add all assigned members
    - When an event conversation is created, it will now add:
      - The event creator
      - All users assigned to the event
    - This ensures event discussions start with all relevant participants
  
  2. Notes
    - Existing events already have their members added via the assignment trigger
    - This change ensures new events have all members added immediately
*/

-- Update function to auto-create event conversation with all members
CREATE OR REPLACE FUNCTION create_event_conversation()
RETURNS trigger AS $$
DECLARE
  new_conv_id uuid;
BEGIN
  -- Create the conversation
  INSERT INTO conversations (type, name, event_id, created_by)
  VALUES ('event', NEW.title, NEW.id, NEW.created_by)
  RETURNING id INTO new_conv_id;

  -- Add the creator
  INSERT INTO conversation_members (conversation_id, user_id)
  VALUES (new_conv_id, NEW.created_by)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  -- Add all assigned members
  INSERT INTO conversation_members (conversation_id, user_id)
  SELECT new_conv_id, ea.user_id
  FROM event_assignments ea
  WHERE ea.event_id = NEW.id
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

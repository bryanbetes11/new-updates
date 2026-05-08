/*
  # Backfill event conversations

  Creates conversations for existing events that were created before
  the auto-creation trigger was added.

  1. Changes
    - Inserts a conversation of type 'event' for any event missing one
    - Adds the event creator as a member of the new conversation
*/

DO $$
DECLARE
  evt RECORD;
  new_conv_id uuid;
BEGIN
  FOR evt IN
    SELECT e.id, e.title, e.created_by
    FROM events e
    LEFT JOIN conversations c ON c.event_id = e.id AND c.type = 'event'
    WHERE c.id IS NULL
  LOOP
    INSERT INTO conversations (type, name, event_id, created_by)
    VALUES ('event', evt.title, evt.id, evt.created_by)
    RETURNING id INTO new_conv_id;

    INSERT INTO conversation_members (conversation_id, user_id)
    VALUES (new_conv_id, evt.created_by)
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END LOOP;
END $$;

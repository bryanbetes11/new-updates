/*
  # Enable Realtime and Notifications for Event Messages

  1. Changes
    - Add event_messages table to realtime publication for instant updates
    - Create trigger to send notifications when new discussion messages are posted
    - Notifications are sent to all event assignees except the message author

  2. Purpose
    - Messages in event discussions sync in real-time without page refresh
    - Team members receive push notifications when others post in discussions
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'event_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE event_messages;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION notify_event_discussion_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event record;
  v_sender record;
  v_assignee record;
BEGIN
  SELECT id, title INTO v_event FROM events WHERE id = NEW.event_id;
  SELECT first_name, last_name INTO v_sender FROM profiles WHERE id = NEW.user_id;

  FOR v_assignee IN
    SELECT DISTINCT ea.user_id 
    FROM event_assignments ea
    WHERE ea.event_id = NEW.event_id 
    AND ea.user_id != NEW.user_id
  LOOP
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      v_assignee.user_id,
      'event_discussion',
      v_event.title || ' Discussion',
      COALESCE(v_sender.first_name, '') || ' ' || COALESCE(v_sender.last_name, '') || ': ' || LEFT(NEW.content, 100),
      jsonb_build_object(
        'event_id', NEW.event_id,
        'message_id', NEW.id,
        'url', '/events/' || NEW.event_id || '?discussion=true'
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_event_message_insert_notify ON event_messages;
CREATE TRIGGER on_event_message_insert_notify
  AFTER INSERT ON event_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_event_discussion_message();

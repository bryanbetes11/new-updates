/*
  # Update Discussion Notification URL

  1. Changes
    - Update the notify_event_discussion_message function to use the new discussion page URL
    - Changed from /events/{id}?discussion=true to /events/{id}/discussion

  2. Purpose
    - Notification clicks now navigate directly to the dedicated discussion page
*/

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
        'url', '/events/' || NEW.event_id || '/discussion'
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

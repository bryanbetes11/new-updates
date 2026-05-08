/*
  # Add message notifications

  1. Problem
    - No notifications are being created when users send messages in conversations
    - Users don't get notified of new messages even though push notification infrastructure exists

  2. Solution
    - Create a trigger function that creates notifications for conversation members when a new message is sent
    - Notify all members except the sender
    - Include conversation and sender information in the notification

  3. Changes
    - Create function: on_message_created() - creates notifications for new messages
    - Add trigger on messages table for INSERT events
*/

CREATE OR REPLACE FUNCTION on_message_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_name text;
  v_conversation conversations%ROWTYPE;
  v_member conversation_members%ROWTYPE;
  v_notification_title text;
  v_notification_body text;
BEGIN
  -- Get sender's name
  SELECT first_name || ' ' || last_name INTO v_sender_name
  FROM profiles
  WHERE id = NEW.sender_id;

  -- Get conversation details
  SELECT * INTO v_conversation
  FROM conversations
  WHERE id = NEW.conversation_id;

  -- Build notification title based on conversation type
  IF v_conversation.type = 'event' THEN
    SELECT title INTO v_notification_title FROM events WHERE id = v_conversation.event_id;
    v_notification_title := 'Event: ' || COALESCE(v_notification_title, 'Discussion');
  ELSIF v_conversation.type = 'personal' THEN
    v_notification_title := v_sender_name;
  ELSE
    v_notification_title := COALESCE(v_conversation.name, 'Group Chat');
  END IF;

  -- Build notification body
  v_notification_body := v_sender_name || ': ' || 
    CASE 
      WHEN NEW.file_url IS NOT NULL AND NEW.file_type = 'image' THEN '📷 Sent a photo'
      WHEN NEW.file_url IS NOT NULL THEN '📎 Sent a file'
      ELSE LEFT(NEW.content, 100)
    END;

  -- Create notification for each member except sender
  FOR v_member IN 
    SELECT * FROM conversation_members 
    WHERE conversation_id = NEW.conversation_id 
    AND user_id != NEW.sender_id
  LOOP
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      v_member.user_id,
      'message',
      v_notification_title,
      v_notification_body,
      jsonb_build_object(
        'conversation_id', NEW.conversation_id,
        'message_id', NEW.id,
        'sender_id', NEW.sender_id
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Add trigger for message notifications
DROP TRIGGER IF EXISTS trg_message_created ON messages;

CREATE TRIGGER trg_message_created
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION on_message_created();

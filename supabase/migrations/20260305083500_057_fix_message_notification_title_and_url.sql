/*
  # Fix Message Notification Title and URL

  1. Problem
    - Message notifications have empty titles
    - URL should point to specific conversation, not just /chat

  2. Solution
    - Fix the notification title to properly show conversation name or sender name
    - Update URL to include conversation ID so clicking notification opens the right chat

  3. Changes
    - Update on_message_created() function to fix title generation
    - Update URL to be /chat?conversation_id=<id> for better navigation
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
  v_notification_url text;
BEGIN
  -- Get sender's name
  SELECT first_name || ' ' || last_name INTO v_sender_name
  FROM profiles
  WHERE id = NEW.sender_id;

  -- Get conversation details
  SELECT * INTO v_conversation
  FROM conversations
  WHERE id = NEW.conversation_id;

  -- Build notification URL
  v_notification_url := '/chat?conversation_id=' || NEW.conversation_id;

  -- Build notification title based on conversation type
  IF v_conversation.type = 'event' THEN
    SELECT title INTO v_notification_title FROM events WHERE id = v_conversation.event_id;
    v_notification_title := COALESCE(v_notification_title, 'Event Discussion');
  ELSIF v_conversation.type = 'personal' THEN
    v_notification_title := v_sender_name;
  ELSE
    v_notification_title := COALESCE(v_conversation.name, 'Group Chat');
  END IF;

  -- Build notification body
  v_notification_body := v_sender_name || ': ' || 
    CASE 
      WHEN NEW.file_url IS NOT NULL AND NEW.file_type = 'image' THEN 'Sent a photo'
      WHEN NEW.file_url IS NOT NULL THEN 'Sent a file'
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
        'url', v_notification_url,
        'conversation_id', NEW.conversation_id,
        'message_id', NEW.id,
        'sender_id', NEW.sender_id
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

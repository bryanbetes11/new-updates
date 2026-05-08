/*
  # Update Notification URLs for Event Discussions

  1. Changes
    - Update on_message_created() function to generate proper URLs for event discussions
    - Event discussion notifications should link to /events/:id?discussion=true instead of /chat?conversation_id=:id
    - Regular chat notifications continue to link to /chat?conversation_id=:id
    - This ensures users are directed to the correct page based on conversation type

  2. URL Structure
    - Event discussions: /events/{event_id}?discussion=true
    - Personal/group chats: /chat?conversation_id={conversation_id}
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

  -- Build notification URL based on conversation type
  IF v_conversation.type = 'event' THEN
    -- Event discussions link to the event detail page with discussion modal
    v_notification_url := '/events/' || v_conversation.event_id || '?discussion=true';
    SELECT title INTO v_notification_title FROM events WHERE id = v_conversation.event_id;
    v_notification_title := COALESCE(v_notification_title, 'Event Discussion');
  ELSE
    -- Regular chats link to the chat page with conversation_id
    v_notification_url := '/chat?conversation_id=' || NEW.conversation_id;
    IF v_conversation.type = 'personal' THEN
      v_notification_title := v_sender_name;
    ELSE
      v_notification_title := COALESCE(v_conversation.name, 'Group Chat');
    END IF;
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

/*
  # Allow message pins and soft deletes safely

  1. Adds an UPDATE policy for conversation message metadata
  2. Adds a trigger guard so only:
     - conversation members can change pin metadata
     - the original sender can soft-delete their own message
  3. Prevents general message edits through the Data API
*/

DROP POLICY IF EXISTS "Members can update message metadata in their conversations" ON public.messages;

CREATE POLICY "Members can update message metadata in their conversations"
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversation_members
      WHERE conversation_members.conversation_id = messages.conversation_id
        AND conversation_members.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.conversation_members
      WHERE conversation_members.conversation_id = messages.conversation_id
        AND conversation_members.user_id = (select auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.guard_message_metadata_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  is_conversation_member boolean;
  pin_changed boolean;
  delete_changed boolean;
BEGIN
  pin_changed :=
    NEW.is_pinned IS DISTINCT FROM OLD.is_pinned
    OR NEW.pinned_by IS DISTINCT FROM OLD.pinned_by
    OR NEW.pinned_at IS DISTINCT FROM OLD.pinned_at;

  delete_changed :=
    NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
    OR NEW.deleted_by IS DISTINCT FROM OLD.deleted_by;

  IF
    NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
    OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
    OR NEW.content IS DISTINCT FROM OLD.content
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR NEW.reply_to IS DISTINCT FROM OLD.reply_to
  THEN
    RAISE EXCEPTION 'Only message metadata updates are allowed';
  END IF;

  IF NOT pin_changed AND NOT delete_changed THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_members
    WHERE conversation_id = OLD.conversation_id
      AND user_id = (select auth.uid())
  ) INTO is_conversation_member;

  IF pin_changed AND NOT is_conversation_member THEN
    RAISE EXCEPTION 'Only conversation members can pin messages';
  END IF;

  IF delete_changed AND OLD.sender_id <> (select auth.uid()) THEN
    RAISE EXCEPTION 'Only the original sender can delete this message';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_message_metadata_update ON public.messages;

CREATE TRIGGER guard_message_metadata_update
BEFORE UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.guard_message_metadata_update();

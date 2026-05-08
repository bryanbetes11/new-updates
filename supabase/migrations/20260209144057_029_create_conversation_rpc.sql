/*
  # Create RPC function for conversation creation

  1. Problem
    - RLS policies on conversations and conversation_members have circular dependencies
    - INSERT on conversation_members checks conversations SELECT, which checks conversation_members SELECT
    - This prevents members from being added after creating a conversation

  2. Solution
    - Create a SECURITY DEFINER function `create_conversation` that bypasses RLS
    - Handles inserting the conversation and all members atomically
    - Returns the new conversation ID
    - Validates the caller is authenticated

  3. Functions
    - `create_personal_conversation(target_user_id uuid)` - Creates a personal chat or returns existing one
    - `create_group_conversation(member_ids uuid[], group_name text)` - Creates a group chat with specified members
*/

CREATE OR REPLACE FUNCTION create_personal_conversation(target_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  existing_conv_id uuid;
  new_conv_id uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF caller_id = target_user_id THEN
    RAISE EXCEPTION 'Cannot create conversation with yourself';
  END IF;

  SELECT cm1.conversation_id INTO existing_conv_id
  FROM conversation_members cm1
  JOIN conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
  JOIN conversations c ON c.id = cm1.conversation_id
  WHERE cm1.user_id = caller_id
    AND cm2.user_id = target_user_id
    AND c.type = 'personal'
  LIMIT 1;

  IF existing_conv_id IS NOT NULL THEN
    RETURN existing_conv_id;
  END IF;

  INSERT INTO conversations (type, created_by)
  VALUES ('personal', caller_id)
  RETURNING id INTO new_conv_id;

  INSERT INTO conversation_members (conversation_id, user_id)
  VALUES
    (new_conv_id, caller_id),
    (new_conv_id, target_user_id);

  RETURN new_conv_id;
END;
$$;

CREATE OR REPLACE FUNCTION create_group_conversation(member_ids uuid[], group_name text DEFAULT 'Group Chat')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  new_conv_id uuid;
  member_id uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF array_length(member_ids, 1) IS NULL OR array_length(member_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Must include at least one member';
  END IF;

  INSERT INTO conversations (type, name, created_by)
  VALUES ('group', group_name, caller_id)
  RETURNING id INTO new_conv_id;

  INSERT INTO conversation_members (conversation_id, user_id)
  VALUES (new_conv_id, caller_id);

  FOREACH member_id IN ARRAY member_ids
  LOOP
    IF member_id != caller_id THEN
      INSERT INTO conversation_members (conversation_id, user_id)
      VALUES (new_conv_id, member_id);
    END IF;
  END LOOP;

  RETURN new_conv_id;
END;
$$;

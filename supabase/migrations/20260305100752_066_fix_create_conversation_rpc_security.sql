/*
  # Fix Create Conversation RPC Security

  1. Changes
    - Updates `create_conversation_with_members()` to use SECURITY DEFINER
    - This allows the function to bypass RLS policies while still using auth.uid()
  
  2. Security
    - Function still uses auth.uid() to set created_by
    - Only authenticated users can call this function
    - All members are explicitly added by the caller
*/

DROP FUNCTION IF EXISTS create_conversation_with_members(text, text, uuid, uuid[]);

CREATE OR REPLACE FUNCTION create_conversation_with_members(
  p_type text,
  p_name text,
  p_event_id uuid DEFAULT NULL,
  p_member_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_conversation_id uuid;
  v_member_id uuid;
BEGIN
  -- Only authenticated users can create conversations
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Create the conversation
  INSERT INTO conversations (type, name, event_id, created_by)
  VALUES (p_type, p_name, p_event_id, auth.uid())
  RETURNING id INTO v_conversation_id;

  -- Add all members
  FOREACH v_member_id IN ARRAY p_member_ids
  LOOP
    INSERT INTO conversation_members (conversation_id, user_id)
    VALUES (v_conversation_id, v_member_id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN v_conversation_id;
END;
$$;

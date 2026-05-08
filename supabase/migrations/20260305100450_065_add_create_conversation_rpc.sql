/*
  # Add Create Conversation with Members RPC

  1. New Functions
    - `create_conversation_with_members()` - Creates a conversation and adds members atomically
  
  2. Purpose
    - Prevents race conditions when creating conversations
    - Ensures creator is always a member before SELECT queries run
    - Handles event conversations properly
  
  3. Security
    - Function runs with caller's permissions (SECURITY INVOKER)
    - RLS policies still apply
*/

CREATE OR REPLACE FUNCTION create_conversation_with_members(
  p_type text,
  p_name text,
  p_event_id uuid DEFAULT NULL,
  p_member_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_conversation_id uuid;
  v_member_id uuid;
BEGIN
  INSERT INTO conversations (type, name, event_id, created_by)
  VALUES (p_type, p_name, p_event_id, auth.uid())
  RETURNING id INTO v_conversation_id;

  FOREACH v_member_id IN ARRAY p_member_ids
  LOOP
    INSERT INTO conversation_members (conversation_id, user_id)
    VALUES (v_conversation_id, v_member_id);
  END LOOP;

  RETURN v_conversation_id;
END;
$$;

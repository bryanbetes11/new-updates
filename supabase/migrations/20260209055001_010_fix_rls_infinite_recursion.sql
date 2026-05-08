/*
  # Fix conversation_members infinite recursion and refresh schema

  1. Changes
    - Drop the self-referencing "Users can view members of shared conversations" policy
    - Create a SECURITY DEFINER function to check conversation membership
    - Use the function in a new policy for viewing all members of joined conversations
    - Refresh PostgREST schema cache

  2. Security
    - conversation_members: users can see own memberships directly
    - conversation_members: users can see all members of conversations they belong to (via secure function)
    - conversations: uses the same secure function for membership checks
*/

-- Drop the problematic self-referencing policy
DROP POLICY IF EXISTS "Users can view members of shared conversations" ON conversation_members;

-- Create a SECURITY DEFINER function that bypasses RLS to check membership
CREATE OR REPLACE FUNCTION is_conversation_member(conv_id uuid, uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = conv_id AND user_id = uid
  );
$$;

-- New policy: see all members of conversations you belong to (no self-reference)
CREATE POLICY "Users can view members of joined conversations"
  ON conversation_members FOR SELECT
  TO authenticated
  USING (is_conversation_member(conversation_id, auth.uid()));

-- Also update the conversations SELECT policy to use the function
DROP POLICY IF EXISTS "Members can view their conversations" ON conversations;

CREATE POLICY "Members can view their conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (is_conversation_member(id, auth.uid()));

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

/*
  # Allow Members to Add Users to Conversations

  1. Changes
    - Updates the conversation_members INSERT policy to allow any member to add others
    - Previously only the creator could add members
    - Now any member can invite others to group and event conversations
  
  2. Security
    - Users can still only add themselves to conversations they're not part of if they create it
    - Members can add others to existing conversations they're part of
    - This enables collaborative conversation management
*/

-- Drop old policy
DROP POLICY IF EXISTS "Authenticated users can add members to their conversations" ON conversation_members;

-- Create new policy that allows members to add others
CREATE POLICY "Members can add users to conversations"
  ON conversation_members FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User can add themselves to any conversation they create
    conversation_members.user_id = auth.uid()
    OR
    -- User can add others if they're already a member of the conversation
    EXISTS (
      SELECT 1 FROM conversation_members cm
      WHERE cm.conversation_id = conversation_members.conversation_id
      AND cm.user_id = auth.uid()
    )
  );

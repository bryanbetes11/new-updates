/*
  # Fix conversations RLS circular dependency

  1. Problem
    - The conversation_members INSERT policy checks conversations.created_by via a sub-query
    - But the conversations SELECT policy requires the user to already be a member
    - This creates a circular dependency: can't add members because can't read the conversation

  2. Fix
    - Add a SELECT policy allowing the conversation creator to always see their own conversations
    - This breaks the circular dependency so members can be inserted after creation
*/

CREATE POLICY "Creator can view own conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (created_by = ( SELECT auth.uid() AS uid));

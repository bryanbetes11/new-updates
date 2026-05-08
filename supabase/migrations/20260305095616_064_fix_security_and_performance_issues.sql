/*
  # Fix Security and Performance Issues

  1. Add Missing Indexes
    - Add indexes for `messages.deleted_by` and `messages.pinned_by` foreign keys
  
  2. Optimize RLS Policies
    - Replace `auth.uid()` with `(select auth.uid())` in all affected policies
    - This prevents re-evaluation for each row, improving performance at scale
  
  3. Remove Duplicate Policies
    - Drop duplicate/redundant RLS policies
  
  4. Remove Duplicate Index
    - Drop duplicate index on message_reactions
  
  5. Fix Function Search Path
    - Set immutable search_path for cleanup function
*/

-- Add missing indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_messages_deleted_by ON messages(deleted_by);
CREATE INDEX IF NOT EXISTS idx_messages_pinned_by ON messages(pinned_by);

-- Drop duplicate index (keep the more descriptive name)
DROP INDEX IF EXISTS idx_message_reactions_message;

-- Fix profiles UPDATE policy
DROP POLICY IF EXISTS "Admin Coordinator and Production Director can update any profil" ON profiles;
CREATE POLICY "Admin Coordinator and Production Director can update any profil"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_preferences
      WHERE user_id = (select auth.uid())
      AND role_id IN (
        SELECT id FROM roles 
        WHERE name IN ('Admin Coordinator', 'Production Director')
      )
    )
  );

-- Fix announcements UPDATE policy
DROP POLICY IF EXISTS "Creator can update announcements" ON announcements;
CREATE POLICY "Creator can update announcements"
  ON announcements FOR UPDATE
  TO authenticated
  USING (created_by = (select auth.uid()))
  WITH CHECK (created_by = (select auth.uid()));

-- Fix announcement_comments UPDATE policy
DROP POLICY IF EXISTS "Comment author can update" ON announcement_comments;
CREATE POLICY "Comment author can update"
  ON announcement_comments FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- Fix push_subscriptions UPDATE policy
DROP POLICY IF EXISTS "Users can update own subscriptions" ON push_subscriptions;
CREATE POLICY "Users can update own subscriptions"
  ON push_subscriptions FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- Fix user_availability DELETE policy
DROP POLICY IF EXISTS "Production Director can delete any availability" ON user_availability;
CREATE POLICY "Production Director can delete any availability"
  ON user_availability FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_preferences
      WHERE user_id = (select auth.uid())
      AND role_id IN (
        SELECT id FROM roles WHERE name = 'Production Director'
      )
    )
  );

-- Fix conversation_members INSERT policy
DROP POLICY IF EXISTS "Members can add users to conversations" ON conversation_members;
CREATE POLICY "Members can add users to conversations"
  ON conversation_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversation_members cm
      WHERE cm.conversation_id = conversation_members.conversation_id
      AND cm.user_id = (select auth.uid())
    )
  );

-- Fix message_reactions policies (drop duplicates and optimize remaining)
DROP POLICY IF EXISTS "Users can add reactions to messages in their conversations" ON message_reactions;
DROP POLICY IF EXISTS "Users can remove their own reactions" ON message_reactions;
DROP POLICY IF EXISTS "Users can view reactions in their conversations" ON message_reactions;

-- Keep only the better-named policies and optimize them
DROP POLICY IF EXISTS "Users can add reactions" ON message_reactions;
CREATE POLICY "Users can add reactions"
  ON message_reactions FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid()) 
    AND EXISTS (
      SELECT 1 FROM messages m
      JOIN conversation_members cm ON cm.conversation_id = m.conversation_id
      WHERE m.id = message_reactions.message_id
      AND cm.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can remove own reactions" ON message_reactions;
CREATE POLICY "Users can remove own reactions"
  ON message_reactions FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Conversation members can view reactions" ON message_reactions;
CREATE POLICY "Conversation members can view reactions"
  ON message_reactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN conversation_members cm ON cm.conversation_id = m.conversation_id
      WHERE m.id = message_reactions.message_id
      AND cm.user_id = (select auth.uid())
    )
  );

-- Fix duplicate conversation_members SELECT policies
DROP POLICY IF EXISTS "Users can view own memberships" ON conversation_members;
-- Keep only "Users can view members of joined conversations"

-- Fix duplicate conversations SELECT policies  
DROP POLICY IF EXISTS "Creator can view own conversations" ON conversations;
-- Keep only "Members can view their conversations"

-- Fix cleanup function search path
DROP FUNCTION IF EXISTS cleanup_inactive_event_discussions();
CREATE OR REPLACE FUNCTION cleanup_inactive_event_discussions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM conversations
  WHERE type = 'event'
  AND id NOT IN (
    SELECT DISTINCT conversation_id 
    FROM messages
  );
END;
$$;

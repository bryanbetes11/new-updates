/*
  # Fix infinite recursion in conversation_members RLS policies

  1. Problem
    - The "Users can view members of joined conversations" policy on conversation_members
      self-references conversation_members, causing infinite recursion
    - This blocks ALL queries that touch conversation_members, including messages and conversations

  2. Solution
    - Create a SECURITY DEFINER helper function `is_conversation_member` that bypasses RLS
    - Replace the self-referencing SELECT policy with one that uses the helper function
    - Also fix the conversations SELECT policy to use the same helper (avoids cross-table recursion)
    - Fix the messages SELECT and INSERT policies similarly

  3. Changes
    - New function: `is_conversation_member(conv_id uuid, uid uuid)` - SECURITY DEFINER
    - Drop and recreate problematic policies on conversation_members, conversations, and messages
*/

CREATE OR REPLACE FUNCTION is_conversation_member(conv_id uuid, uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = conv_id AND user_id = uid
  );
$$;

-- Fix conversation_members SELECT policies
DROP POLICY IF EXISTS "Users can view members of joined conversations" ON conversation_members;

CREATE POLICY "Users can view members of joined conversations"
  ON conversation_members FOR SELECT
  TO authenticated
  USING (is_conversation_member(conversation_id, ( SELECT auth.uid() AS uid)));

-- Fix conversations SELECT policy that references conversation_members
DROP POLICY IF EXISTS "Members can view their conversations" ON conversations;

CREATE POLICY "Members can view their conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (is_conversation_member(id, ( SELECT auth.uid() AS uid)));

-- Fix messages policies that reference conversation_members
DROP POLICY IF EXISTS "Members can view messages in their conversations" ON messages;

CREATE POLICY "Members can view messages in their conversations"
  ON messages FOR SELECT
  TO authenticated
  USING (is_conversation_member(conversation_id, ( SELECT auth.uid() AS uid)));

DROP POLICY IF EXISTS "Members can send messages to their conversations" ON messages;

CREATE POLICY "Members can send messages to their conversations"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = ( SELECT auth.uid() AS uid)
    AND is_conversation_member(conversation_id, ( SELECT auth.uid() AS uid))
  );

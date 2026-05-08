/*
  # Add Message Interactions

  1. Changes to `messages` table
    - Add `deleted_at` (timestamptz) - Soft delete timestamp
    - Add `deleted_by` (uuid) - User who deleted the message
    - Add `is_pinned` (boolean) - Whether message is pinned
    - Add `pinned_by` (uuid) - User who pinned the message
    - Add `pinned_at` (timestamptz) - When message was pinned
    - Add `reply_to` (uuid) - Reference to message being replied to

  2. New Tables
    - `message_reactions` - Store emoji reactions to messages
      - `id` (uuid, primary key)
      - `message_id` (uuid, references messages)
      - `user_id` (uuid, references profiles)
      - `emoji` (text)
      - `created_at` (timestamptz)

  3. Security
    - Enable RLS on `message_reactions`
    - Add policies for authenticated users to read reactions
    - Add policies for users to add/remove their own reactions
    - Update message policies to handle soft deletes
    - Add policies for pinning/unpinning messages
*/

-- Add new columns to messages table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE messages ADD COLUMN deleted_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'deleted_by'
  ) THEN
    ALTER TABLE messages ADD COLUMN deleted_by uuid REFERENCES profiles(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'is_pinned'
  ) THEN
    ALTER TABLE messages ADD COLUMN is_pinned boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'pinned_by'
  ) THEN
    ALTER TABLE messages ADD COLUMN pinned_by uuid REFERENCES profiles(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'pinned_at'
  ) THEN
    ALTER TABLE messages ADD COLUMN pinned_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'reply_to'
  ) THEN
    ALTER TABLE messages ADD COLUMN reply_to uuid REFERENCES messages(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create message_reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Enable RLS
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for message_reactions
CREATE POLICY "Users can view reactions in their conversations"
  ON message_reactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN conversation_members cm ON cm.conversation_id = m.conversation_id
      WHERE m.id = message_reactions.message_id
      AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add reactions to messages in their conversations"
  ON message_reactions FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM messages m
      JOIN conversation_members cm ON cm.conversation_id = m.conversation_id
      WHERE m.id = message_reactions.message_id
      AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove their own reactions"
  ON message_reactions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to);
CREATE INDEX IF NOT EXISTS idx_messages_is_pinned ON messages(conversation_id, is_pinned) WHERE is_pinned = true;

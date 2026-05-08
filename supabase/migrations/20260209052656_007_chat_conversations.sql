/*
  # Chat & Messaging System

  1. New Tables
    - `conversations`
      - `id` (uuid, primary key)
      - `type` (text: 'personal', 'group', 'event')
      - `name` (text, display name for group/event chats)
      - `event_id` (uuid, nullable, references events for event discussions)
      - `created_by` (uuid, references auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    - `conversation_members`
      - `id` (uuid, primary key)
      - `conversation_id` (uuid, references conversations)
      - `user_id` (uuid, references auth.users)
      - `joined_at` (timestamptz)
      - `last_read_at` (timestamptz)
    - `messages`
      - `id` (uuid, primary key)
      - `conversation_id` (uuid, references conversations)
      - `sender_id` (uuid, references auth.users)
      - `content` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Conversation members can view their conversations
    - Conversation members can view and send messages
    - Users can view their own memberships

  3. Triggers
    - Auto-create event conversation when an event is created
    - Auto-update conversations.updated_at when a new message is inserted

  4. Indexes
    - conversation_members(conversation_id, user_id) unique
    - messages(conversation_id, created_at)
    - conversations(event_id) for event lookups
*/

-- conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'personal' CHECK (type IN ('personal', 'group', 'event')),
  name text DEFAULT '',
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- conversation_members table
CREATE TABLE IF NOT EXISTS conversation_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  joined_at timestamptz DEFAULT now(),
  last_read_at timestamptz DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;

-- messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id),
  content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages(conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_conversations_event_id
  ON conversations(event_id);

CREATE INDEX IF NOT EXISTS idx_conversation_members_user_id
  ON conversation_members(user_id);

-- RLS Policies for conversations
CREATE POLICY "Members can view their conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_members.conversation_id = conversations.id
      AND conversation_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator can update conversation"
  ON conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator can delete conversation"
  ON conversations FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- RLS Policies for conversation_members
CREATE POLICY "Members can view conversation members"
  ON conversation_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_members cm
      WHERE cm.conversation_id = conversation_members.conversation_id
      AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can add members to their conversations"
  ON conversation_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_members.conversation_id
      AND conversations.created_by = auth.uid()
    )
    OR conversation_members.user_id = auth.uid()
  );

CREATE POLICY "Users can update their own membership"
  ON conversation_members FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Creator can remove members"
  ON conversation_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_members.conversation_id
      AND conversations.created_by = auth.uid()
    )
    OR user_id = auth.uid()
  );

-- RLS Policies for messages
CREATE POLICY "Members can view messages in their conversations"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_members.conversation_id = messages.conversation_id
      AND conversation_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can send messages to their conversations"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_members.conversation_id = messages.conversation_id
      AND conversation_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Sender can delete own messages"
  ON messages FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id);

-- Function to update conversation updated_at on new message
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS trigger AS $$
BEGIN
  UPDATE conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_new_message_update_conversation
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_timestamp();

-- Function to auto-create event conversation
CREATE OR REPLACE FUNCTION create_event_conversation()
RETURNS trigger AS $$
BEGIN
  INSERT INTO conversations (type, name, event_id, created_by)
  VALUES ('event', NEW.title, NEW.id, NEW.created_by);

  INSERT INTO conversation_members (conversation_id, user_id)
  SELECT c.id, NEW.created_by
  FROM conversations c
  WHERE c.event_id = NEW.id
  LIMIT 1;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_event_create_conversation
  AFTER INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION create_event_conversation();

-- Function to auto-add assigned users to event conversation
CREATE OR REPLACE FUNCTION add_assigned_user_to_event_chat()
RETURNS trigger AS $$
BEGIN
  INSERT INTO conversation_members (conversation_id, user_id)
  SELECT c.id, NEW.user_id
  FROM conversations c
  WHERE c.event_id = NEW.event_id
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_assignment_add_to_event_chat
  AFTER INSERT ON event_assignments
  FOR EACH ROW
  EXECUTE FUNCTION add_assigned_user_to_event_chat();

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_members;

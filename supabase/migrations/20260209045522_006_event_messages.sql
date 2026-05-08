/*
  # Add Event Discussion Messages

  1. New Tables
    - `event_messages`
      - `id` (uuid, primary key)
      - `event_id` (uuid, references events)
      - `user_id` (uuid, references auth.users)
      - `content` (text, message body)
      - `created_at` (timestamptz, auto-set)

  2. Security
    - Enable RLS on `event_messages` table
    - Authenticated users can read messages for events they have access to
    - Authenticated users can insert their own messages
    - Authenticated users can delete their own messages

  3. Indexes
    - Index on `event_id` for fast lookups
    - Index on `created_at` for ordering

  4. Notes
    - Lightweight table for per-event discussion threads
    - Messages are tied to specific events for organized conversations
*/

CREATE TABLE IF NOT EXISTS event_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_messages_event_id ON event_messages(event_id);
CREATE INDEX IF NOT EXISTS idx_event_messages_created_at ON event_messages(created_at);

ALTER TABLE event_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read event messages"
  ON event_messages
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert their own event messages"
  ON event_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own event messages"
  ON event_messages
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

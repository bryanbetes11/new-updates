/*
  # Add pin and reply columns to messages

  1. Modified Tables
    - `messages`
      - Add `is_pinned` (boolean, default false) - whether the message is pinned
      - Add `pinned_by` (uuid, nullable) - who pinned the message
      - Add `pinned_at` (timestamptz, nullable) - when it was pinned
      - Add `reply_to_id` (uuid, nullable) - references another message for threading

  2. Indexes
    - Index on messages(reply_to_id) for reply lookups
*/

ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS pinned_by uuid REFERENCES auth.users(id);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS pinned_at timestamptz;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_reply_to_id ON messages(reply_to_id);

/*
  # Setlist Reminder Tracking

  ## Summary
  Adds a table to track manual setlist reminders sent by leadership to assigned users.

  ## New Tables
  - `setlist_reminders`
    - `id` (uuid, PK)
    - `event_id` (uuid, FK → events) — which event the reminder is for
    - `user_id` (uuid, FK → profiles) — the recipient (song leader)
    - `sent_by` (uuid, FK → profiles) — which leader sent it
    - `sent_at` (timestamptz) — when it was sent

  ## Purpose
  - Allows leadership to see how many reminders were sent per event/user combo
  - Prevents duplicate sends within a short window
  - Used by the SetlistDeadlines leadership view

  ## Security
  - RLS enabled
  - Only authenticated users (leadership) can insert
  - Only authenticated users can read
*/

CREATE TABLE IF NOT EXISTS setlist_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sent_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_setlist_reminders_event_user ON setlist_reminders(event_id, user_id);

ALTER TABLE setlist_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leadership can insert setlist reminders"
  ON setlist_reminders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sent_by);

CREATE POLICY "Leadership can view setlist reminders"
  ON setlist_reminders FOR SELECT
  TO authenticated
  USING (true);

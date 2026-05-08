/*
  # Add proposal due date and linked event fields

  1. Changes
    - Add `proposal_due_date` (timestamptz) to events table for setlist submission deadlines
    - Add `linked_event_id` (uuid) to events table for rehearsals to link to Sunday Services
    - Add foreign key constraint for linked_event_id
    - Add `song_leader_id` (uuid) to events table for tracking assigned song leader
    - Add foreign key constraint for song_leader_id

  2. Purpose
    - Allow automatic calculation of proposal due dates based on event type
    - Enable rehearsals to be linked to specific Sunday Services
    - Track which song leader is assigned to an event
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'proposal_due_date'
  ) THEN
    ALTER TABLE events ADD COLUMN proposal_due_date timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'linked_event_id'
  ) THEN
    ALTER TABLE events ADD COLUMN linked_event_id uuid REFERENCES events(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'song_leader_id'
  ) THEN
    ALTER TABLE events ADD COLUMN song_leader_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_events_linked_event ON events(linked_event_id);
CREATE INDEX IF NOT EXISTS idx_events_song_leader ON events(song_leader_id);
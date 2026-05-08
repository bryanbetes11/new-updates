/*
  # Add new team roles, leave approval workflow, and song categories

  1. New Roles (seed data)
    - Keys, Guitar, Bass, Drums, Backup Vocals, Visuals, Lights, Audio
    - These are non-leadership instrument/technical roles for event assignments

  2. Modified Tables
    - `user_availability`
      - Added `status` (text: pending/approved/rejected) - for leader approval workflow
      - Added `approved_by` (uuid, FK profiles) - which leader reviewed the request
      - Added `reviewed_at` (timestamptz) - when the review happened
    - `setlist_songs`
      - Added `song_category` (text) - song slot category (opening/praise/worship/offering/closing)

  3. Security
    - Added policy so leaders (any authenticated user) can update availability status
    - Frontend enforces that only leadership roles can approve/reject

  4. Important Notes
    - Existing availability records will default to 'pending' status
    - The approval workflow: user submits leave -> leaders approve/reject
    - Song categories map to spreadsheet columns for import compatibility
*/

-- Add new instrument/technical roles
INSERT INTO roles (name, is_leadership, sort_order) VALUES
  ('Keys', false, 6),
  ('Guitar', false, 7),
  ('Bass', false, 8),
  ('Drums', false, 9),
  ('Backup Vocals', false, 10),
  ('Visuals', false, 11),
  ('Lights', false, 12),
  ('Audio', false, 13)
ON CONFLICT (name) DO NOTHING;

-- Add status column to user_availability for approval workflow
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_availability' AND column_name = 'status'
  ) THEN
    ALTER TABLE user_availability ADD COLUMN status text NOT NULL DEFAULT 'pending';
  END IF;
END $$;

-- Add approved_by column to track which leader reviewed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_availability' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE user_availability ADD COLUMN approved_by uuid REFERENCES profiles(id);
  END IF;
END $$;

-- Add reviewed_at timestamp
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_availability' AND column_name = 'reviewed_at'
  ) THEN
    ALTER TABLE user_availability ADD COLUMN reviewed_at timestamptz;
  END IF;
END $$;

-- Add song_category to setlist_songs for categorized setlists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'setlist_songs' AND column_name = 'song_category'
  ) THEN
    ALTER TABLE setlist_songs ADD COLUMN song_category text NOT NULL DEFAULT '';
  END IF;
END $$;

-- Allow any authenticated user to update availability (leaders approve via frontend)
-- This works alongside existing owner-only policy via OR logic
CREATE POLICY "Leaders can approve leave requests"
  ON user_availability FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

/*
  # Add Release Notes Last Viewed Timestamp

  1. Changes
    - Add `release_notes_last_viewed_at` column to user_preferences table
    - This timestamp tracks when the user last viewed the release notes modal
    - Allows showing the modal once per day instead of on every home tab click

  2. Notes
    - NULL means the user has never viewed release notes
    - The frontend will compare this timestamp with current time to determine if 24 hours have passed
*/

-- Add release_notes_last_viewed_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_preferences' AND column_name = 'release_notes_last_viewed_at'
  ) THEN
    ALTER TABLE user_preferences ADD COLUMN release_notes_last_viewed_at timestamptz;
  END IF;
END $$;

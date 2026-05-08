/*
  # Add Release Notes Preference

  1. Changes
    - Add `hide_release_notes_v1` column to user_preferences table
    - This allows users to dismiss the release notes modal permanently

  2. Notes
    - The existing user_preferences table is for role preferences
    - We're adding a new column to track dismissed release notes
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_preferences' AND column_name = 'hide_release_notes_v1'
  ) THEN
    ALTER TABLE user_preferences ADD COLUMN hide_release_notes_v1 boolean DEFAULT false;
  END IF;
END $$;

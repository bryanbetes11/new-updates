/*
  # Fix User Preferences Table for General Settings

  1. Changes
    - Make `role_id` column nullable in user_preferences table
    - This allows the table to store both role-specific preferences and general user settings
    - Update unique constraint to allow multiple general preference rows per user

  2. Security
    - Existing RLS policies remain unchanged
    - Users can still only manage their own preferences

  3. Notes
    - This fixes the issue where hide_release_notes_v1 couldn't be saved
    - The role_id will be NULL for general preferences like release notes dismissal
*/

-- Make role_id nullable
ALTER TABLE user_preferences ALTER COLUMN role_id DROP NOT NULL;

-- Drop the old unique constraint
ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_user_id_role_id_key;

-- Add a new unique constraint that handles NULL role_id properly
-- For role-specific preferences: user_id + role_id must be unique
-- For general preferences: we'll allow multiple rows (though in practice we'll upsert)
CREATE UNIQUE INDEX IF NOT EXISTS user_preferences_user_role_unique 
  ON user_preferences(user_id, role_id) 
  WHERE role_id IS NOT NULL;

-- Add an update policy if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_preferences' 
    AND policyname = 'Users can update own preferences'
  ) THEN
    CREATE POLICY "Users can update own preferences"
      ON user_preferences FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
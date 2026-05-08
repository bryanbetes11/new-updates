/*
  # Allow NULL values for event descriptions

  1. Changes
    - Alter `events` table `description` column to allow NULL values
    - This allows users to remove event descriptions when editing events

  2. Notes
    - Existing empty descriptions ('') will remain as empty strings
    - New events can now have NULL descriptions instead of empty strings
*/

-- Allow NULL values for event descriptions
ALTER TABLE events ALTER COLUMN description DROP NOT NULL;

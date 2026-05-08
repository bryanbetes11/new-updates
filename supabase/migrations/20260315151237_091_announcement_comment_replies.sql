/*
  # Add reply_to support for announcement comments

  ## Changes
  - Adds `reply_to` column to `announcement_comments` table (nullable UUID FK to itself)
  - Allows comments to reference a parent comment for threaded reply display

  ## Security
  - No new RLS policies needed; existing comment policies cover the new column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'announcement_comments' AND column_name = 'reply_to'
  ) THEN
    ALTER TABLE announcement_comments
      ADD COLUMN reply_to uuid REFERENCES announcement_comments(id) ON DELETE SET NULL;
  END IF;
END $$;

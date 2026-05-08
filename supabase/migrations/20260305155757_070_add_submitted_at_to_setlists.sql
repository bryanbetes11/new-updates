/*
  # Add submitted_at column to setlists

  1. Modified Tables
    - `setlists`
      - `submitted_at` (timestamptz, nullable) - Records when the setlist was submitted for review

  2. Notes
    - This column is used to accurately calculate whether a proposal was submitted late
    - Previously, `created_at` was used which records when the setlist was first created (draft),
      not when it was actually submitted for review
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'setlists' AND column_name = 'submitted_at'
  ) THEN
    ALTER TABLE setlists ADD COLUMN submitted_at timestamptz;
  END IF;
END $$;

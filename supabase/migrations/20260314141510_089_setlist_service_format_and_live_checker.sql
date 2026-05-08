/*
  # Setlist Service Format & Live Checker Fields

  ## Summary
  Adds lightweight fields to support the embedded live setlist checker feature.

  ## New Columns on `setlists`
  - `service_format` (text): One of 'sunday_full', 'sunday_short', 'special_event', 'opening_closing_only', 'custom'
    Defaults to NULL (existing rows unaffected, UI will infer from event_type).
  - `flow_score` (int): 0–100 score from last checker run, for quick display
  - `content_score` (int): 0–100 theological/content score from last checker run
  - `checker_summary` (text): Short plain-English summary of last checker result
  - `last_checker_run_at` (timestamptz): When the checker was last run

  ## New Columns on `setlist_songs`
  - `section_role` (text): Optional override label — e.g. 'Opening', 'Praise', 'Worship', etc.
    Distinct from song_category (song_category = library classification, section_role = setlist placement role)
  - `is_manual_entry` (boolean): True if this song was added manually (not from library)

  ## Notes
  - All new columns are nullable or have safe defaults
  - No existing data is modified
  - RLS policies remain unchanged (inherited from existing table policies)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'setlists' AND column_name = 'service_format'
  ) THEN
    ALTER TABLE setlists ADD COLUMN service_format text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'setlists' AND column_name = 'flow_score'
  ) THEN
    ALTER TABLE setlists ADD COLUMN flow_score int DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'setlists' AND column_name = 'content_score'
  ) THEN
    ALTER TABLE setlists ADD COLUMN content_score int DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'setlists' AND column_name = 'checker_summary'
  ) THEN
    ALTER TABLE setlists ADD COLUMN checker_summary text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'setlists' AND column_name = 'last_checker_run_at'
  ) THEN
    ALTER TABLE setlists ADD COLUMN last_checker_run_at timestamptz DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'setlist_songs' AND column_name = 'section_role'
  ) THEN
    ALTER TABLE setlist_songs ADD COLUMN section_role text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'setlist_songs' AND column_name = 'is_manual_entry'
  ) THEN
    ALTER TABLE setlist_songs ADD COLUMN is_manual_entry boolean DEFAULT false;
  END IF;
END $$;

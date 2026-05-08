/*
  # Add performed key to setlist songs

  1. Modified Tables
    - `setlist_songs`
      - `performed_key` (text, default '') - The key the song will be performed in for this specific setlist, which may differ from the song's default key in the library

  2. Important Notes
    - This allows song leaders to pick a different key per setlist without changing the library default
    - Empty string means "use the song's default key from the library"
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'setlist_songs' AND column_name = 'performed_key'
  ) THEN
    ALTER TABLE setlist_songs ADD COLUMN performed_key text NOT NULL DEFAULT '';
  END IF;
END $$;
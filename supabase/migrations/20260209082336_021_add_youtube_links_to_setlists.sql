-- # Add YouTube link support to setlist songs
--
-- 1. Changes
--    - Add youtube_url column to setlist_songs table
--    - Stores YouTube video link for reference during worship
-- 2. Notes
--    - Field is optional (nullable)
--    - Allows teams to reference video demonstrations or tutorials

ALTER TABLE setlist_songs ADD COLUMN IF NOT EXISTS youtube_url text DEFAULT '';

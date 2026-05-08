/*
  # Add YouTube URL to Songs Table

  1. Changes
    - Add youtube_url column to songs table
    - Stores default YouTube video link for the song
  
  2. Notes
    - Optional field - allows default video reference when song is created
    - Can be overridden per setlist in setlist_songs table
*/

ALTER TABLE songs ADD COLUMN IF NOT EXISTS youtube_url text DEFAULT '';

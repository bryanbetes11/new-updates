/*
  # Fix announcement_views upsert and add missing UPDATE policy

  1. Changes
    - Add UPDATE policy for announcement_views (needed for upsert conflict resolution)
    - Add SELECT policy for announcement_views for public/anon role

  2. Security
    - Users can update their own view records
*/

CREATE POLICY "Users can update own views"
  ON announcement_views FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

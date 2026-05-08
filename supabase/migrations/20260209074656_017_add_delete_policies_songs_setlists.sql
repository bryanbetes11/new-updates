/*
  # Add DELETE policies for songs and setlists

  1. Security Changes
    - Add DELETE policy on `songs` table for authenticated users
    - Add DELETE policy on `setlists` table for authenticated users

  2. Notes
    - Allows any authenticated team member to delete songs and setlists
    - Required for library management (bulk delete from Song Tracker and Past Setlists)
*/

CREATE POLICY "Authenticated users can delete songs"
  ON songs
  FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete setlists"
  ON setlists
  FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

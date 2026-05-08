/*
  # Fix Announcements Update Policy

  1. Changes
    - Drop and recreate the "Creator can update announcements" policy
    - Add WITH CHECK clause to ensure users can only update their own announcements

  2. Security
    - Ensures users cannot change the created_by field to another user
    - Maintains data integrity by validating both USING and WITH CHECK
*/

DROP POLICY IF EXISTS "Creator can update announcements" ON announcements;

CREATE POLICY "Creator can update announcements"
  ON announcements FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

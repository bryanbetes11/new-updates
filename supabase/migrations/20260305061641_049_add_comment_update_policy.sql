/*
  # Add Comment Update Policy

  1. Changes
    - Add UPDATE policy for announcement_comments
    - Allow comment authors to edit their own comments

  2. Security
    - Only the user who created the comment can update it
    - Prevents users from modifying other users' comments
*/

CREATE POLICY "Comment author can update"
  ON announcement_comments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

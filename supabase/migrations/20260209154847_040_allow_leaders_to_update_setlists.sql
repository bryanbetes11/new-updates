/*
  # Allow leaders to update setlists

  1. Changes
    - Add UPDATE policy on `setlists` table so that leadership roles
      (Admin Coordinator, Music Director, Stage Director, Production Director, Setlist Coordinator)
      can update any setlist (e.g. approve or request revision)
    - The existing "Setlist creator can update setlists" policy remains so creators
      can still update their own setlists

  2. Security
    - Only authenticated users with leadership roles can update other users' setlists
    - Non-leaders can still only update setlists they created (existing policy)
*/

CREATE POLICY "Leaders can update any setlist"
  ON setlists
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      JOIN roles ON roles.id = user_roles.role_id
      WHERE user_roles.user_id = (SELECT auth.uid())
      AND roles.name IN ('Admin Coordinator', 'Music Director', 'Stage Director', 'Production Director', 'Setlist Coordinator')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      JOIN roles ON roles.id = user_roles.role_id
      WHERE user_roles.user_id = (SELECT auth.uid())
      AND roles.name IN ('Admin Coordinator', 'Music Director', 'Stage Director', 'Production Director', 'Setlist Coordinator')
    )
  );

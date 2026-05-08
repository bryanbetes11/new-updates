/*
  # Fix leadership profile update RLS policy

  1. Problem
    - The existing "Admin Coordinator and Production Director can update any profil" policy
      incorrectly references `user_preferences` instead of `user_roles`.
    - It also lacks a WITH CHECK clause, making it asymmetric and ineffective.
    - As a result, Production Directors and Admin Coordinators cannot update other users' profiles.

  2. Fix
    - Drop the broken policy.
    - Recreate it correctly using `user_roles` joined to `roles`, with both USING and WITH CHECK.
    - Roles granted: Admin Coordinator, Production Director (matching canManageMembers + canApproveLeave).

  3. No other policies or tables are changed.
*/

DROP POLICY IF EXISTS "Admin Coordinator and Production Director can update any profil" ON profiles;

CREATE POLICY "Admin Coordinator and Production Director can update any profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = (SELECT auth.uid())
        AND r.name IN ('Admin Coordinator', 'Production Director')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = (SELECT auth.uid())
        AND r.name IN ('Admin Coordinator', 'Production Director')
    )
  );

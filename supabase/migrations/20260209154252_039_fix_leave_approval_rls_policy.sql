/*
  # Fix Leave Approval RLS Policy

  1. Problem
    - The "Leaders can approve leave requests" policy references old role names
      ('Worship Leader', 'Assistant Worship Leader', 'Admin') that no longer exist
    - Roles were renamed but the RLS policy was not updated
    - This prevents leaders from approving or rejecting leave requests

  2. Solution
    - Update the policy to use the is_leadership flag instead of hardcoded role names
    - This is more maintainable and won't break if roles are renamed again

  3. Changes
    - Drop and recreate "Leaders can approve leave requests" policy
    - Use is_leadership flag from roles table for authorization check
*/

DROP POLICY IF EXISTS "Leaders can approve leave requests" ON user_availability;

CREATE POLICY "Leaders can approve leave requests"
  ON user_availability
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (SELECT auth.uid())
      AND user_roles.role_id IN (
        SELECT roles.id FROM roles WHERE roles.is_leadership = true
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = (SELECT auth.uid())
      AND user_roles.role_id IN (
        SELECT roles.id FROM roles WHERE roles.is_leadership = true
      )
    )
  );

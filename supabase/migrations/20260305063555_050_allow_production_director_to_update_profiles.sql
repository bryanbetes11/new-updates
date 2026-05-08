/*
  # Allow Production Director to update any profile

  1. Changes
    - Drop existing "Admins can update any profile" policy
    - Create new policy allowing both Admin Coordinator and Production Director to update profiles
    - Production Director is the highest role and should have full team management capabilities

  2. Security
    - Only users with Admin Coordinator or Production Director role can update any profile
    - All other users can only update their own profile (existing policy)
*/

-- Drop the old policy
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;

-- Create new policy allowing Admin Coordinator and Production Director
CREATE POLICY "Admin Coordinator and Production Director can update any profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() 
      AND r.name IN ('Admin Coordinator', 'Production Director')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() 
      AND r.name IN ('Admin Coordinator', 'Production Director')
    )
  );

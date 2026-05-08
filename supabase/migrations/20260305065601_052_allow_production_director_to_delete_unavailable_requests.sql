/*
  # Allow Production Director to delete any unavailable requests

  1. Changes
    - Drop existing "Users can delete own availability" policy
    - Create new DELETE policy allowing users to delete their own requests
    - Create new DELETE policy allowing Production Directors to delete any request
    - Production Director has full control over team availability management

  2. Security
    - All users can still delete their own unavailable requests
    - Production Directors can delete any unavailable request
    - Other users cannot delete requests they didn't create
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Users can delete own availability" ON user_availability;

-- Create new DELETE policy for own requests
CREATE POLICY "Users can delete own availability"
  ON user_availability FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Create new DELETE policy for Production Directors
CREATE POLICY "Production Director can delete any availability"
  ON user_availability FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() 
      AND r.name = 'Production Director'
    )
  );
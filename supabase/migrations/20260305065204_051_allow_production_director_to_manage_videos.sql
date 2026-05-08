/*
  # Allow Production Director to manage all videos

  1. Changes
    - Drop existing "Uploader can update videos" policy
    - Drop existing "Uploader can delete videos" policy
    - Create new UPDATE policy allowing both uploader and Production Director
    - Create new DELETE policy allowing both uploader and Production Director
    - Production Director has full control over video library

  2. Security
    - Original uploaders can still update and delete their own videos
    - Production Directors can update and delete any video
    - All other users cannot modify videos they didn't upload
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Uploader can update videos" ON videos;
DROP POLICY IF EXISTS "Uploader can delete videos" ON videos;

-- Create new UPDATE policy
CREATE POLICY "Uploader and Production Director can update videos"
  ON videos FOR UPDATE
  TO authenticated
  USING (
    uploaded_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() 
      AND r.name = 'Production Director'
    )
  )
  WITH CHECK (
    uploaded_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() 
      AND r.name = 'Production Director'
    )
  );

-- Create new DELETE policy
CREATE POLICY "Uploader and Production Director can delete videos"
  ON videos FOR DELETE
  TO authenticated
  USING (
    uploaded_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() 
      AND r.name = 'Production Director'
    )
  );
/*
  # Allow public access to roles for registration

  1. Changes
    - Add policy to allow anonymous users to view roles during registration
    - This is safe as roles are just metadata (role names like "Singer", "Musician")
    - No sensitive user data is exposed

  2. Security
    - Only SELECT access is granted
    - No INSERT, UPDATE, or DELETE permissions for anonymous users
    - Existing authenticated user policies remain unchanged
*/

-- Allow anonymous users to view roles for registration page
CREATE POLICY "Anyone can view roles"
  ON roles FOR SELECT
  TO anon
  USING (true);
/*
  # Add Foreign Key Hint for user_availability

  1. Changes
    - Add COMMENT hint for PostgREST to understand the user_id -> profiles relationship
    - This enables the `profiles(*)` join syntax in Supabase queries

  2. Notes
    - The foreign key constraint already exists
    - This just adds metadata for the API layer
*/

COMMENT ON CONSTRAINT user_availability_user_id_fkey 
ON user_availability 
IS 'user_availability.user_id -> profiles.id';

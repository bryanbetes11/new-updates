/*
  # Add Foreign Key Hint for User Availability Profiles Join

  1. Changes
    - Add a comment to the user_availability.user_id foreign key to help PostgREST 
      understand the relationship when joining with profiles table
    - This enables the query: user_availability.select('*, profiles(...)') to work correctly

  2. Notes
    - PostgREST uses these hints when there are multiple foreign keys to the same table
    - This allows the frontend to properly fetch profile information for unavailable users
*/

-- Add a comment hint for PostgREST to know which relationship to use
COMMENT ON CONSTRAINT user_availability_user_id_fkey 
ON user_availability 
IS 'user_availability has one profiles via user_id';

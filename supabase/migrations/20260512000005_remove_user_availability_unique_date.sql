-- Remove the unique constraint that prevents multiple requests for the same date
-- This allows a user to have a standard Leave Request and a Sub/Swap Request on the same day
ALTER TABLE public.user_availability 
  DROP CONSTRAINT IF EXISTS user_availability_user_id_unavailable_date_key;

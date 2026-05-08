/*
  # Fix Function Search Paths

  This migration fixes functions with mutable search_path by setting them to
  use an immutable search_path for security.

  ## Changes
  1. Alter `get_quarter_from_date` function - set search_path
  2. Alter `get_quarter_start_date` function - set search_path
  3. Alter `get_quarter_end_date` function - set search_path
  4. Alter `get_user_offense_level` function - set search_path
  5. Alter `get_name_prefix` function - set search_path
  6. Alter `get_relative_date_text` function - set search_path

  ## Security
  - Prevents search_path manipulation attacks
  - No changes to function logic
*/

ALTER FUNCTION public.get_quarter_from_date SET search_path = public;
ALTER FUNCTION public.get_quarter_start_date SET search_path = public;
ALTER FUNCTION public.get_quarter_end_date SET search_path = public;
ALTER FUNCTION public.get_user_offense_level SET search_path = public;
ALTER FUNCTION public.get_name_prefix SET search_path = public;
ALTER FUNCTION public.get_relative_date_text SET search_path = public;

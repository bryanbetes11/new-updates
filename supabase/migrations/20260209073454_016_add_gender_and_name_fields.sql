/*
  # Add gender, second_name, and middle_name to profiles

  1. Modified Tables
    - `profiles`
      - `gender` (text) - 'male' or 'female', nullable
      - `second_name` (text) - second given name, defaults to ''
      - `middle_name` (text) - middle name, defaults to ''

  2. Notes
    - Gender is used for display prefixes (Bro./Sis.) in the app
    - Uses IF NOT EXISTS checks for safety
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'gender'
  ) THEN
    ALTER TABLE profiles ADD COLUMN gender text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'second_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN second_name text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'middle_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN middle_name text DEFAULT '';
  END IF;
END $$;

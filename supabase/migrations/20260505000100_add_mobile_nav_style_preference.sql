/*
  # Add mobile nav style preference

  1. Changes
    - Add `mobile_nav_style` to `user_preferences`
    - Used for general per-user mobile nav appearance preference

  2. Notes
    - NULL means use device-based default
    - `floating` and `docked` are the only valid explicit values
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_preferences' AND column_name = 'mobile_nav_style'
  ) THEN
    ALTER TABLE public.user_preferences
      ADD COLUMN mobile_nav_style text
      CHECK (mobile_nav_style IN ('floating', 'docked'));
  END IF;
END $$;

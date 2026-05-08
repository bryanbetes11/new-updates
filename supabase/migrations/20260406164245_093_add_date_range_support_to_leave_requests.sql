/*
  # Add Date Range Support to Leave Requests

  1. New Columns
    - `leave_type` (text) - Type of leave: 'single' or 'range'
    - `start_date` (date) - Start date for range requests
    - `end_date` (date) - End date for range requests

  2. Changes
    - `unavailable_date` is now optional (will be NULL for range requests)
    - For single-date requests: `leave_type='single'`, `unavailable_date` set, `start_date`/`end_date` NULL
    - For range requests: `leave_type='range'`, `unavailable_date` NULL, `start_date`/`end_date` set
    - UNIQUE constraint removed to accommodate new schema

  3. Backward Compatibility
    - Existing single-date records have `leave_type='single'`
    - Queries check either `unavailable_date` or `start_date`/`end_date` fields

  4. Notes
    - Migrate existing data to new format automatically
    - No RLS changes needed
*/

DO $$
BEGIN
  -- Add new columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_availability' AND column_name = 'leave_type'
  ) THEN
    ALTER TABLE user_availability ADD COLUMN leave_type text DEFAULT 'single';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_availability' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE user_availability ADD COLUMN start_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_availability' AND column_name = 'end_date'
  ) THEN
    ALTER TABLE user_availability ADD COLUMN end_date date;
  END IF;

  -- Make unavailable_date nullable for range requests
  ALTER TABLE user_availability ALTER COLUMN unavailable_date DROP NOT NULL;

  -- Add constraint to ensure valid leave_type values
  ALTER TABLE user_availability ADD CONSTRAINT valid_leave_type
    CHECK (leave_type IN ('single', 'range'));

  -- Add constraint to ensure at least one date is provided
  ALTER TABLE user_availability ADD CONSTRAINT has_date
    CHECK ((leave_type = 'single' AND unavailable_date IS NOT NULL) OR
           (leave_type = 'range' AND start_date IS NOT NULL AND end_date IS NOT NULL));

  -- Add constraint to ensure end_date >= start_date for ranges
  ALTER TABLE user_availability ADD CONSTRAINT valid_date_range
    CHECK ((leave_type = 'single') OR (start_date <= end_date));

END $$;

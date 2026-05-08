/*
  # Backfill submitted_at and add auto-set trigger

  1. Data Backfill
    - Sets `submitted_at` for approved/pending_review setlists that don't have it
    - Uses the earliest "setlist_submitted" notification timestamp when available
    - Falls back to `created_at` for setlists with no submission notification

  2. New Trigger
    - `set_submitted_at_on_review` trigger on `setlists` table
    - Automatically sets `submitted_at = now()` when status changes to `pending_review`
    - Only sets it if `submitted_at` is currently null (preserves original submission time on resubmissions)
*/

-- Backfill from notifications where possible
UPDATE setlists s
SET submitted_at = sub.first_submitted
FROM (
  SELECT DISTINCT ON (n.data->>'setlist_id')
    (n.data->>'setlist_id')::uuid AS setlist_id,
    n.created_at AS first_submitted
  FROM notifications n
  WHERE n.type = 'setlist_submitted'
    AND n.data->>'setlist_id' IS NOT NULL
  ORDER BY n.data->>'setlist_id', n.created_at ASC
) sub
WHERE s.id = sub.setlist_id
  AND s.submitted_at IS NULL;

-- For any remaining setlists that were submitted/approved but have no notification record,
-- fall back to created_at
UPDATE setlists
SET submitted_at = created_at
WHERE submitted_at IS NULL
  AND status IN ('pending_review', 'approved', 'revision_requested');

-- Create trigger function to auto-set submitted_at
CREATE OR REPLACE FUNCTION set_submitted_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending_review' AND (OLD.status IS DISTINCT FROM 'pending_review') AND NEW.submitted_at IS NULL THEN
    NEW.submitted_at = now();
  END IF;
  RETURN NEW;
END;
$$;

-- Create the trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_submitted_at'
  ) THEN
    CREATE TRIGGER trg_set_submitted_at
      BEFORE UPDATE ON setlists
      FOR EACH ROW
      EXECUTE FUNCTION set_submitted_at();
  END IF;
END $$;

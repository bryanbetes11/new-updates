/*
  # Setlist Draft / Submit / Review Workflow Upgrade

  ## Summary
  Adds the remaining fields needed to support a full draft → submitted → review → approved/rejected
  workflow for setlists, and aligns the status enum to include 'rejected'.

  ## Changes

  ### setlists table
  - Add `review_note` (text, nullable) — reviewer's note when requesting revision or rejecting
  - Add `last_edited_at` (timestamptz) — auto-updated any time the setlist row is touched
  - Add `reviewed_at` (timestamptz, nullable) — when a reviewer made their last decision
  - Add `reviewed_by` (uuid, nullable) — who made the last review decision

  ### Status Enum Alignment
  - The status column is stored as text; we simply allow the new value 'rejected' in RLS
    policies and application logic — no enum type change needed.

  ### Trigger
  - `setlists_set_last_edited_at` — fires on UPDATE to stamp `last_edited_at = now()`

  ### RLS Policies
  - Existing policies are preserved; no changes needed — all values are text-based.

  ## Security
  - No RLS changes required; existing policies cover the new columns as part of the row.
*/

-- Add review_note column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'setlists' AND column_name = 'review_note'
  ) THEN
    ALTER TABLE setlists ADD COLUMN review_note text;
  END IF;
END $$;

-- Add last_edited_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'setlists' AND column_name = 'last_edited_at'
  ) THEN
    ALTER TABLE setlists ADD COLUMN last_edited_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Add reviewed_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'setlists' AND column_name = 'reviewed_at'
  ) THEN
    ALTER TABLE setlists ADD COLUMN reviewed_at timestamptz;
  END IF;
END $$;

-- Add reviewed_by column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'setlists' AND column_name = 'reviewed_by'
  ) THEN
    ALTER TABLE setlists ADD COLUMN reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Trigger function: stamp last_edited_at on every update
CREATE OR REPLACE FUNCTION set_setlist_last_edited_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.last_edited_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS setlists_set_last_edited_at ON setlists;
CREATE TRIGGER setlists_set_last_edited_at
  BEFORE UPDATE ON setlists
  FOR EACH ROW
  EXECUTE FUNCTION set_setlist_last_edited_at();

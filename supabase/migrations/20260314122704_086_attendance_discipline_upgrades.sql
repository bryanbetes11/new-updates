/*
  # Attendance & Discipline Upgrades

  ## Summary
  Major enhancements to attendance tracking and discipline management.

  ### Attendance Changes
  1. Add 'excused' status to event_attendance
  2. Add marked_by, marked_at, excused_reason, override_by, override_at audit columns
  3. Add leadership attendance insert/update policies

  ### Profile Additions
  - ministry_status: 'active' | 'restoration' | 'suspended' | 'inactive'
  - leadership_notes: internal notes visible to leadership only

  ### Leave Upgrades
  - approval_notes on user_availability
  - is_recurring + recurrence_type for recurring requests

  ### Discipline Records (new table)
  - Full discipline lifecycle tracking
  - Source: attendance | setlist | manual
  - Status: open | verbal_warning | counselling | suspension | resolved
  - Quarter-aware, audit-fielded, RLS-secured

  ### Updated Functions
  - get_all_members_attendance_stats: now includes excused_count, ministry_status
  - get_member_attendance_history: new per-member history
  - get_event_attendance_roster: new per-event marking roster
*/

-- 1. Add 'excused' to event_attendance status check
ALTER TABLE event_attendance DROP CONSTRAINT IF EXISTS event_attendance_status_check;
ALTER TABLE event_attendance ADD CONSTRAINT event_attendance_status_check 
  CHECK (status IN ('present', 'late', 'absent', 'excused'));

-- 2. Add audit/override columns to event_attendance
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_attendance' AND column_name = 'marked_by') THEN
    ALTER TABLE event_attendance ADD COLUMN marked_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_attendance' AND column_name = 'marked_at') THEN
    ALTER TABLE event_attendance ADD COLUMN marked_at timestamptz DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_attendance' AND column_name = 'excused_reason') THEN
    ALTER TABLE event_attendance ADD COLUMN excused_reason text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_attendance' AND column_name = 'override_by') THEN
    ALTER TABLE event_attendance ADD COLUMN override_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_attendance' AND column_name = 'override_at') THEN
    ALTER TABLE event_attendance ADD COLUMN override_at timestamptz;
  END IF;
END $$;

-- 3. Allow leadership to update/insert any attendance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'event_attendance' AND policyname = 'Leadership can update any attendance'
  ) THEN
    CREATE POLICY "Leadership can update any attendance"
      ON event_attendance FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = (SELECT auth.uid()) AND r.is_leadership = true
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = (SELECT auth.uid()) AND r.is_leadership = true
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'event_attendance' AND policyname = 'Leadership can insert attendance for any user'
  ) THEN
    CREATE POLICY "Leadership can insert attendance for any user"
      ON event_attendance FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = (SELECT auth.uid()) AND r.is_leadership = true
        )
      );
  END IF;
END $$;

-- 4. Add ministry_status and leadership_notes to profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'ministry_status') THEN
    ALTER TABLE profiles ADD COLUMN ministry_status text NOT NULL DEFAULT 'active' 
      CHECK (ministry_status IN ('active', 'restoration', 'suspended', 'inactive'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'leadership_notes') THEN
    ALTER TABLE profiles ADD COLUMN leadership_notes text;
  END IF;
END $$;

-- 5. Add approval_notes and recurring fields to user_availability
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_availability' AND column_name = 'approval_notes') THEN
    ALTER TABLE user_availability ADD COLUMN approval_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_availability' AND column_name = 'is_recurring') THEN
    ALTER TABLE user_availability ADD COLUMN is_recurring boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_availability' AND column_name = 'recurrence_type') THEN
    ALTER TABLE user_availability ADD COLUMN recurrence_type text CHECK (recurrence_type IN ('weekly', 'biweekly', 'monthly'));
  END IF;
END $$;

-- 6. Create discipline_records table
CREATE TABLE IF NOT EXISTS discipline_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('attendance', 'setlist', 'manual')),
  offense_number integer CHECK (offense_number BETWEEN 1 AND 4),
  quarter_year integer,
  quarter_number integer CHECK (quarter_number BETWEEN 1 AND 4),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'verbal_warning', 'counselling', 'suspension', 'resolved')),
  title text NOT NULL,
  notes text,
  leader_notes text,
  final_decision text,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discipline_records_user_id ON discipline_records(user_id);
CREATE INDEX IF NOT EXISTS idx_discipline_records_status ON discipline_records(status);
CREATE INDEX IF NOT EXISTS idx_discipline_records_created_at ON discipline_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discipline_records_quarter ON discipline_records(quarter_year, quarter_number);

ALTER TABLE discipline_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own discipline records"
  ON discipline_records FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Leadership can view all discipline records"
  ON discipline_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = (SELECT auth.uid()) AND r.is_leadership = true
    )
  );

CREATE POLICY "Leadership can insert discipline records"
  ON discipline_records FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = (SELECT auth.uid()) AND r.is_leadership = true
    )
  );

CREATE POLICY "Leadership can update discipline records"
  ON discipline_records FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = (SELECT auth.uid()) AND r.is_leadership = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = (SELECT auth.uid()) AND r.is_leadership = true
    )
  );

COMMENT ON CONSTRAINT discipline_records_user_id_fkey ON discipline_records IS 
  E'@foreignKey (user_id) REFERENCES profiles (id)|@fieldName profile|@foreignFieldName discipline_records';

COMMENT ON CONSTRAINT discipline_records_created_by_fkey ON discipline_records IS 
  E'@foreignKey (created_by) REFERENCES profiles (id)|@fieldName created_by_profile|@foreignFieldName created_discipline_records';

-- 7. Updated offense level function (v2)
CREATE OR REPLACE FUNCTION get_user_offense_level_v2(p_late_count integer, p_absent_count integer)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_late_count >= 12 OR p_absent_count >= 4 THEN RETURN 4;
  ELSIF p_late_count >= 9 OR p_absent_count >= 3 THEN RETURN 3;
  ELSIF p_late_count >= 6 OR p_absent_count >= 2 THEN RETURN 2;
  ELSIF p_late_count >= 3 OR p_absent_count >= 1 THEN RETURN 1;
  ELSE RETURN 0;
  END IF;
END;
$$;

-- 8. Replace get_all_members_attendance_stats with upgraded version
DROP FUNCTION IF EXISTS get_all_members_attendance_stats(integer, integer);

CREATE FUNCTION get_all_members_attendance_stats(p_year integer, p_quarter integer)
RETURNS TABLE (
  user_id uuid,
  first_name text,
  last_name text,
  nickname text,
  avatar_url text,
  ministry_status text,
  events_assigned bigint,
  present_count bigint,
  late_count bigint,
  absent_count bigint,
  excused_count bigint,
  offense_level integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_start_date date;
  v_end_date date;
BEGIN
  v_start_date := get_quarter_start_date(p_year, p_quarter);
  v_end_date := get_quarter_end_date(p_year, p_quarter);

  RETURN QUERY
  SELECT
    p.id AS user_id,
    p.first_name,
    p.last_name,
    p.nickname,
    p.avatar_url,
    p.ministry_status,
    COUNT(ea.id) AS events_assigned,
    COUNT(CASE WHEN ea.status = 'present' THEN 1 END) AS present_count,
    COUNT(CASE WHEN ea.status = 'late' THEN 1 END) AS late_count,
    COUNT(CASE WHEN ea.status = 'absent' THEN 1 END) AS absent_count,
    COUNT(CASE WHEN ea.status = 'excused' THEN 1 END) AS excused_count,
    get_user_offense_level_v2(
      COUNT(CASE WHEN ea.status = 'late' THEN 1 END)::integer,
      COUNT(CASE WHEN ea.status = 'absent' THEN 1 END)::integer
    ) AS offense_level
  FROM profiles p
  LEFT JOIN event_attendance ea ON ea.user_id = p.id
    AND ea.is_assigned = true
    AND EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = ea.event_id
        AND e.event_date BETWEEN v_start_date AND v_end_date
    )
  WHERE p.is_onboarded = true
  GROUP BY p.id, p.first_name, p.last_name, p.nickname, p.avatar_url, p.ministry_status
  ORDER BY offense_level DESC, p.first_name;
END;
$$;

-- 9. Per-member attendance history function
CREATE OR REPLACE FUNCTION get_member_attendance_history(p_user_id uuid, p_limit integer DEFAULT 20)
RETURNS TABLE (
  attendance_id uuid,
  event_id uuid,
  event_title text,
  event_date date,
  event_type text,
  status text,
  checked_in_at timestamptz,
  marked_at timestamptz,
  excused_reason text,
  notes text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ea.id AS attendance_id,
    e.id AS event_id,
    e.title AS event_title,
    e.event_date::date,
    e.event_type,
    ea.status,
    ea.checked_in_at,
    ea.marked_at,
    ea.excused_reason,
    ea.notes
  FROM event_attendance ea
  JOIN events e ON e.id = ea.event_id
  WHERE ea.user_id = p_user_id
  ORDER BY e.event_date DESC, e.start_time DESC
  LIMIT p_limit;
END;
$$;

-- 10. Per-event attendance roster for marking
CREATE OR REPLACE FUNCTION get_event_attendance_roster(p_event_id uuid)
RETURNS TABLE (
  user_id uuid,
  first_name text,
  last_name text,
  nickname text,
  avatar_url text,
  gender text,
  role_name text,
  attendance_id uuid,
  status text,
  checked_in_at timestamptz,
  marked_at timestamptz,
  excused_reason text,
  notes text,
  is_assigned boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS user_id,
    p.first_name,
    p.last_name,
    p.nickname,
    p.avatar_url,
    p.gender,
    r.name AS role_name,
    ea.id AS attendance_id,
    ea.status,
    ea.checked_in_at,
    ea.marked_at,
    ea.excused_reason,
    ea.notes,
    true AS is_assigned
  FROM event_assignments evta
  JOIN profiles p ON p.id = evta.user_id
  JOIN roles r ON r.id = evta.role_id
  LEFT JOIN event_attendance ea ON ea.event_id = p_event_id AND ea.user_id = p.id
  WHERE evta.event_id = p_event_id
    AND evta.status = 'confirmed'
  ORDER BY p.first_name, p.last_name;
END;
$$;

/*
  # Quarter Helper Functions

  1. New Functions
    - `get_quarter_from_date(date)` - Returns quarter number (1-4) from a date
    - `get_quarter_start_date(year, quarter)` - Returns start date of a quarter
    - `get_quarter_end_date(year, quarter)` - Returns end date of a quarter
    - `get_user_attendance_stats(user_id, year, quarter)` - Returns attendance stats for a user
    - `get_user_offense_level(lates, absences)` - Calculates offense level based on counts

  2. Quarter Definitions
    - Q1: January 1 - March 31
    - Q2: April 1 - June 30
    - Q3: July 1 - September 30
    - Q4: October 1 - December 31
*/

-- Get quarter number from a date
CREATE OR REPLACE FUNCTION get_quarter_from_date(d date)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
AS $$
  SELECT CEIL(EXTRACT(MONTH FROM d)::numeric / 3)::integer;
$$;

-- Get start date of a quarter
CREATE OR REPLACE FUNCTION get_quarter_start_date(year_num integer, quarter_num integer)
RETURNS date
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
AS $$
  SELECT make_date(year_num, (quarter_num - 1) * 3 + 1, 1);
$$;

-- Get end date of a quarter
CREATE OR REPLACE FUNCTION get_quarter_end_date(year_num integer, quarter_num integer)
RETURNS date
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
AS $$
  SELECT (make_date(year_num, quarter_num * 3, 1) + interval '1 month' - interval '1 day')::date;
$$;

-- Calculate offense level based on lates and absences
-- Rules:
-- 1st Offense: 3 lates OR 1 absence
-- 2nd Offense: 6 lates OR 2 absences
-- 3rd Offense: 9 lates OR 3 absences
-- 4th Offense: 12 lates OR 4 absences
CREATE OR REPLACE FUNCTION get_user_offense_level(late_count integer, absent_count integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
AS $$
  SELECT GREATEST(
    CASE 
      WHEN late_count >= 12 THEN 4
      WHEN late_count >= 9 THEN 3
      WHEN late_count >= 6 THEN 2
      WHEN late_count >= 3 THEN 1
      ELSE 0
    END,
    CASE 
      WHEN absent_count >= 4 THEN 4
      WHEN absent_count >= 3 THEN 3
      WHEN absent_count >= 2 THEN 2
      WHEN absent_count >= 1 THEN 1
      ELSE 0
    END
  );
$$;

-- Get attendance stats for a user in a specific quarter
CREATE OR REPLACE FUNCTION get_user_attendance_stats(
  p_user_id uuid,
  p_year integer,
  p_quarter integer
)
RETURNS TABLE (
  events_assigned bigint,
  present_count bigint,
  late_count bigint,
  absent_count bigint,
  offense_level integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_quarter_start date;
  v_quarter_end date;
  v_present bigint;
  v_late bigint;
  v_absent bigint;
  v_assigned bigint;
BEGIN
  v_quarter_start := get_quarter_start_date(p_year, p_quarter);
  v_quarter_end := get_quarter_end_date(p_year, p_quarter);

  -- Count events assigned in the quarter
  SELECT COUNT(*) INTO v_assigned
  FROM event_assignments ea
  JOIN events e ON e.id = ea.event_id
  WHERE ea.user_id = p_user_id
    AND e.event_date BETWEEN v_quarter_start AND v_quarter_end;

  -- Count attendance records
  SELECT 
    COALESCE(SUM(CASE WHEN att.status = 'present' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN att.status = 'late' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN att.status = 'absent' THEN 1 ELSE 0 END), 0)
  INTO v_present, v_late, v_absent
  FROM event_attendance att
  JOIN events e ON e.id = att.event_id
  WHERE att.user_id = p_user_id
    AND att.is_assigned = true
    AND e.event_date BETWEEN v_quarter_start AND v_quarter_end;

  RETURN QUERY SELECT 
    v_assigned,
    v_present,
    v_late,
    v_absent,
    get_user_offense_level(v_late::integer, v_absent::integer);
END;
$$;

-- Get all members' attendance stats for a quarter (for leadership dashboard)
CREATE OR REPLACE FUNCTION get_all_members_attendance_stats(
  p_year integer,
  p_quarter integer
)
RETURNS TABLE (
  user_id uuid,
  first_name text,
  last_name text,
  nickname text,
  avatar_url text,
  events_assigned bigint,
  present_count bigint,
  late_count bigint,
  absent_count bigint,
  offense_level integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_quarter_start date;
  v_quarter_end date;
BEGIN
  v_quarter_start := get_quarter_start_date(p_year, p_quarter);
  v_quarter_end := get_quarter_end_date(p_year, p_quarter);

  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.first_name,
    p.last_name,
    p.nickname,
    p.avatar_url,
    COALESCE(assigned.cnt, 0::bigint) as events_assigned,
    COALESCE(att_stats.present_cnt, 0::bigint) as present_count,
    COALESCE(att_stats.late_cnt, 0::bigint) as late_count,
    COALESCE(att_stats.absent_cnt, 0::bigint) as absent_count,
    get_user_offense_level(
      COALESCE(att_stats.late_cnt, 0)::integer, 
      COALESCE(att_stats.absent_cnt, 0)::integer
    ) as offense_level
  FROM profiles p
  LEFT JOIN (
    SELECT ea.user_id, COUNT(*) as cnt
    FROM event_assignments ea
    JOIN events e ON e.id = ea.event_id
    WHERE e.event_date BETWEEN v_quarter_start AND v_quarter_end
    GROUP BY ea.user_id
  ) assigned ON assigned.user_id = p.id
  LEFT JOIN (
    SELECT 
      att.user_id,
      SUM(CASE WHEN att.status = 'present' THEN 1 ELSE 0 END) as present_cnt,
      SUM(CASE WHEN att.status = 'late' THEN 1 ELSE 0 END) as late_cnt,
      SUM(CASE WHEN att.status = 'absent' THEN 1 ELSE 0 END) as absent_cnt
    FROM event_attendance att
    JOIN events e ON e.id = att.event_id
    WHERE att.is_assigned = true
      AND e.event_date BETWEEN v_quarter_start AND v_quarter_end
    GROUP BY att.user_id
  ) att_stats ON att_stats.user_id = p.id
  WHERE p.is_onboarded = true
  ORDER BY p.last_name, p.first_name;
END;
$$;

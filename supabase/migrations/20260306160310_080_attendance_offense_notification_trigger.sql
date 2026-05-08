/*
  # Attendance Offense Notification Trigger

  1. New Trigger Function
    - `on_attendance_recorded()` - Triggered when attendance is inserted/updated
    - Calculates user's current offense level for the quarter
    - Sends notifications to appropriate leadership when offense thresholds are reached
    - Prevents duplicate notifications by checking attendance_offense_notifications table

  2. Notification Recipients by Offense Level
    - 1st Offense: Admin Coordinator, Music Director
    - 2nd Offense: Production Director
    - 3rd Offense: Production Director
    - 4th Offense: All Leadership roles

  3. Action Required Messages
    - 1st: Verbal Warning by Admin Coordinator or Music Director
    - 2nd: Verbal Warning by Production Director
    - 3rd: Counselling (closed door meeting with Pastors)
    - 4th: Suspension
*/

-- Create trigger function for attendance offense notifications
CREATE OR REPLACE FUNCTION on_attendance_recorded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_date date;
  v_quarter integer;
  v_year integer;
  v_late_count integer;
  v_absent_count integer;
  v_offense_level integer;
  v_previous_offense_level integer;
  v_user_name text;
  v_notification_title text;
  v_notification_body text;
  v_action_required text;
  v_recipient_id uuid;
  v_offense_reason text;
BEGIN
  -- Only process if status is 'late' or 'absent' and is_assigned is true
  IF NEW.status NOT IN ('late', 'absent') OR NEW.is_assigned = false THEN
    RETURN NEW;
  END IF;

  -- Get event date
  SELECT event_date INTO v_event_date
  FROM events WHERE id = NEW.event_id;

  -- Calculate quarter and year
  v_quarter := get_quarter_from_date(v_event_date);
  v_year := EXTRACT(YEAR FROM v_event_date)::integer;

  -- Get current attendance stats for the user in this quarter
  SELECT 
    COALESCE(SUM(CASE WHEN att.status = 'late' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN att.status = 'absent' THEN 1 ELSE 0 END), 0)
  INTO v_late_count, v_absent_count
  FROM event_attendance att
  JOIN events e ON e.id = att.event_id
  WHERE att.user_id = NEW.user_id
    AND att.is_assigned = true
    AND e.event_date BETWEEN get_quarter_start_date(v_year, v_quarter) AND get_quarter_end_date(v_year, v_quarter);

  -- Calculate offense level
  v_offense_level := get_user_offense_level(v_late_count, v_absent_count);

  -- If no offense, exit
  IF v_offense_level = 0 THEN
    RETURN NEW;
  END IF;

  -- Check if we already notified for this offense level
  SELECT MAX(offense_level) INTO v_previous_offense_level
  FROM attendance_offense_notifications
  WHERE user_id = NEW.user_id
    AND quarter_year = v_year
    AND quarter_number = v_quarter;

  -- If already notified for this or higher level, exit
  IF v_previous_offense_level IS NOT NULL AND v_previous_offense_level >= v_offense_level THEN
    RETURN NEW;
  END IF;

  -- Get user's name
  SELECT CONCAT(first_name, ' ', last_name) INTO v_user_name
  FROM profiles WHERE id = NEW.user_id;

  -- Determine offense reason text
  IF v_absent_count >= v_offense_level THEN
    v_offense_reason := v_absent_count || ' absence' || CASE WHEN v_absent_count > 1 THEN 's' ELSE '' END;
  ELSE
    v_offense_reason := v_late_count || ' late' || CASE WHEN v_late_count > 1 THEN 's' ELSE '' END;
  END IF;

  -- Set notification content based on offense level
  CASE v_offense_level
    WHEN 1 THEN
      v_notification_title := 'Attendance Alert';
      v_action_required := 'Verbal Warning by Admin Coordinator or Music Director';
    WHEN 2 THEN
      v_notification_title := 'Attendance Alert';
      v_action_required := 'Verbal Warning by Production Director';
    WHEN 3 THEN
      v_notification_title := 'Attendance Alert';
      v_action_required := 'Counselling session with Pastors';
    WHEN 4 THEN
      v_notification_title := 'URGENT - Attendance Alert';
      v_action_required := 'Suspension';
  END CASE;

  v_notification_body := v_user_name || ' has reached ' || 
    CASE v_offense_level
      WHEN 1 THEN '1st'
      WHEN 2 THEN '2nd'
      WHEN 3 THEN '3rd'
      WHEN 4 THEN '4th'
    END || ' Offense (' || v_offense_reason || ') for Q' || v_quarter || ' ' || v_year || 
    '. Action required: ' || v_action_required || '.';

  -- Insert notifications for appropriate recipients
  IF v_offense_level = 1 THEN
    -- Notify Admin Coordinator and Music Director
    FOR v_recipient_id IN
      SELECT ur.user_id FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE r.name IN ('Admin Coordinator', 'Music Director')
    LOOP
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (v_recipient_id, 'attendance_alert', v_notification_title, v_notification_body, 
        jsonb_build_object('offense_user_id', NEW.user_id, 'offense_level', v_offense_level, 'url', '/manage?tab=attendance'));
    END LOOP;
  ELSIF v_offense_level IN (2, 3) THEN
    -- Notify Production Director
    FOR v_recipient_id IN
      SELECT ur.user_id FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE r.name = 'Production Director'
    LOOP
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (v_recipient_id, 'attendance_alert', v_notification_title, v_notification_body,
        jsonb_build_object('offense_user_id', NEW.user_id, 'offense_level', v_offense_level, 'url', '/manage?tab=attendance'));
    END LOOP;
  ELSIF v_offense_level = 4 THEN
    -- Notify all leadership
    FOR v_recipient_id IN
      SELECT DISTINCT ur.user_id FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE r.is_leadership = true
    LOOP
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (v_recipient_id, 'attendance_alert', v_notification_title, v_notification_body,
        jsonb_build_object('offense_user_id', NEW.user_id, 'offense_level', v_offense_level, 'url', '/manage?tab=attendance'));
    END LOOP;
  END IF;

  -- Record that we've notified for this offense level
  INSERT INTO attendance_offense_notifications (user_id, quarter_year, quarter_number, offense_level)
  VALUES (NEW.user_id, v_year, v_quarter, v_offense_level)
  ON CONFLICT (user_id, quarter_year, quarter_number, offense_level) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Create trigger on event_attendance
DROP TRIGGER IF EXISTS on_attendance_recorded_trigger ON event_attendance;
CREATE TRIGGER on_attendance_recorded_trigger
  AFTER INSERT OR UPDATE ON event_attendance
  FOR EACH ROW
  EXECUTE FUNCTION on_attendance_recorded();

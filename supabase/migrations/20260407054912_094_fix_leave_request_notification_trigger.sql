/*
  # Fix Leave Request Notification Trigger for Date Ranges

  1. Changes
    - Update `on_leave_request_created()` function to handle both single-date and date-range requests
    - Generate appropriate notification message based on leave type
    - Handle NULL body by providing a fallback message

  2. Notification Messages
    - Single date: "User requested to be unavailable on [DATE]"
    - Date range: "User requested to be unavailable from [START] to [END]"
*/

CREATE OR REPLACE FUNCTION on_leave_request_created()
RETURNS trigger AS $$
DECLARE
  v_user_name text;
  v_leader record;
  v_date_text text;
  v_body text;
BEGIN
  SELECT first_name || ' ' || last_name INTO v_user_name FROM profiles WHERE id = NEW.user_id;

  -- Build date text based on leave type
  IF NEW.leave_type = 'single' AND NEW.unavailable_date IS NOT NULL THEN
    v_date_text := 'on ' || to_char(NEW.unavailable_date, 'Mon DD, YYYY');
  ELSIF NEW.leave_type = 'range' AND NEW.start_date IS NOT NULL AND NEW.end_date IS NOT NULL THEN
    v_date_text := 'from ' || to_char(NEW.start_date, 'Mon DD') || ' to ' || to_char(NEW.end_date, 'Mon DD, YYYY');
  ELSE
    v_date_text := 'for an unavailable period';
  END IF;

  -- Build notification body with reason if provided
  v_body := v_user_name || ' requested to be unavailable ' || v_date_text;
  IF NEW.reason IS NOT NULL AND NEW.reason != '' THEN
    v_body := v_body || ' -- ' || NEW.reason;
  END IF;

  -- Notify all leaders
  FOR v_leader IN
    SELECT DISTINCT ur.user_id
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE r.is_leadership = true
      AND ur.user_id != NEW.user_id
  LOOP
    PERFORM create_notification(
      v_leader.user_id,
      'leave_request',
      'New Unavailable Day Request',
      v_body,
      jsonb_build_object('leave_id', NEW.id::text, 'user_id', NEW.user_id::text, 'type', 'leave_request', 'url', '/unavailable-requests')
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

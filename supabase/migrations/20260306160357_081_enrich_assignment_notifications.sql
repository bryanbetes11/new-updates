/*
  # Enrich Assignment Notification Messages

  Updates notification triggers to include richer information:
  - Event type (Sunday Service, Rehearsal, etc.)
  - Song Leader name with Bro./Sis. prefix
  - Relative date context ("which is tomorrow", "which is today")

  1. Modified Functions
    - `on_event_assignment_created()` - Now includes event type, song leader, and relative date
    - `on_assignment_status_changed()` - Now includes event type and relative date
    - `on_setlist_status_changed()` - Now includes event type

  2. Example Output Formats
    - Assignment: "You have been assigned as Keys for Sunday Service with Song Leader Bro. Christian Leones on March 7, 2026 which is tomorrow."
    - For Rehearsals: "You have been assigned as Keys for Sunday Service Rehearsal. Song Leader is Bro. Christian Leones on March 7, 2026."
*/

-- Helper function to get gender prefix
CREATE OR REPLACE FUNCTION get_name_prefix(p_gender text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
AS $$
  SELECT CASE 
    WHEN p_gender = 'Male' THEN 'Bro. '
    WHEN p_gender = 'Female' THEN 'Sis. '
    ELSE ''
  END;
$$;

-- Helper function to get relative date text
CREATE OR REPLACE FUNCTION get_relative_date_text(p_event_date date)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT CASE 
    WHEN p_event_date = CURRENT_DATE THEN ' which is today'
    WHEN p_event_date = CURRENT_DATE + 1 THEN ' which is tomorrow'
    ELSE ''
  END;
$$;

-- 1. on_event_assignment_created with enriched message
CREATE OR REPLACE FUNCTION on_event_assignment_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event record;
  v_role_name text;
  v_date_str text;
  v_relative_date text;
  v_song_leader_name text;
  v_song_leader_prefix text;
  v_body text;
  v_linked_event record;
BEGIN
  -- Get event details
  SELECT * INTO v_event FROM events WHERE id = NEW.event_id;
  SELECT name INTO v_role_name FROM roles WHERE id = NEW.role_id;

  v_date_str := TO_CHAR(v_event.event_date, 'FMMonth FMDD, YYYY');
  v_relative_date := get_relative_date_text(v_event.event_date);

  -- Get song leader info (from event or linked event for rehearsals)
  IF v_event.song_leader_id IS NOT NULL THEN
    SELECT 
      get_name_prefix(gender) || first_name || ' ' || last_name
    INTO v_song_leader_name
    FROM profiles WHERE id = v_event.song_leader_id;
  ELSIF v_event.linked_event_id IS NOT NULL THEN
    -- For rehearsals, get song leader from linked Sunday Service
    SELECT * INTO v_linked_event FROM events WHERE id = v_event.linked_event_id;
    IF v_linked_event.song_leader_id IS NOT NULL THEN
      SELECT 
        get_name_prefix(gender) || first_name || ' ' || last_name
      INTO v_song_leader_name
      FROM profiles WHERE id = v_linked_event.song_leader_id;
    END IF;
  END IF;

  -- Build the notification body
  IF v_event.event_type = 'Rehearsal' AND v_event.linked_event_id IS NOT NULL THEN
    -- Rehearsal linked to a Sunday Service
    v_body := 'You have been assigned as ' || v_role_name || ' for Sunday Service Rehearsal';
    IF v_song_leader_name IS NOT NULL THEN
      v_body := v_body || '. Song Leader is ' || v_song_leader_name;
    END IF;
    v_body := v_body || ' on ' || v_date_str || v_relative_date || '.';
  ELSE
    -- Regular event (Sunday Service, etc.)
    v_body := 'You have been assigned as ' || v_role_name || ' for ' || v_event.title;
    IF v_song_leader_name IS NOT NULL THEN
      v_body := v_body || ' with Song Leader ' || v_song_leader_name;
    END IF;
    v_body := v_body || ' on ' || v_date_str || v_relative_date || '.';
  END IF;

  PERFORM create_notification(
    NEW.user_id,
    'assignment',
    'New Assignment',
    v_body,
    jsonb_build_object('event_id', NEW.event_id::text, 'assignment_id', NEW.id::text, 'url', '/events/' || NEW.event_id::text)
  );
  RETURN NEW;
END;
$$;

-- 2. on_assignment_status_changed with enriched message
CREATE OR REPLACE FUNCTION on_assignment_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event record;
  v_user_name text;
  v_status_text text;
  v_date_str text;
  v_relative_date text;
  v_event_display text;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_event FROM events WHERE id = NEW.event_id;
  SELECT first_name || ' ' || last_name INTO v_user_name FROM profiles WHERE id = NEW.user_id;

  IF NEW.status = 'confirmed' THEN
    v_status_text := 'confirmed';
  ELSIF NEW.status = 'declined' THEN
    v_status_text := 'declined';
  ELSE
    RETURN NEW;
  END IF;

  v_date_str := TO_CHAR(v_event.event_date, 'FMMonth FMDD, YYYY');
  v_relative_date := get_relative_date_text(v_event.event_date);

  -- Build event display text
  IF v_event.event_type = 'Rehearsal' AND v_event.linked_event_id IS NOT NULL THEN
    v_event_display := 'Sunday Service Rehearsal';
  ELSE
    v_event_display := v_event.title;
  END IF;

  PERFORM create_notification(
    v_event.created_by,
    'assignment_response',
    'Assignment ' || initcap(v_status_text),
    v_user_name || ' has ' || v_status_text || ' their assignment for ' || v_event_display || ' on ' || v_date_str || v_relative_date || '.',
    jsonb_build_object('event_id', NEW.event_id::text, 'assignment_id', NEW.id::text, 'url', '/events/' || NEW.event_id::text)
  );
  RETURN NEW;
END;
$$;

-- 3. on_setlist_status_changed with event type
CREATE OR REPLACE FUNCTION on_setlist_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event record;
  v_date_str text;
  v_event_display text;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_event FROM events WHERE id = NEW.event_id;
  v_date_str := TO_CHAR(v_event.event_date, 'FMMonth FMDD, YYYY');

  -- Build event display text
  IF v_event.event_type = 'Rehearsal' AND v_event.linked_event_id IS NOT NULL THEN
    v_event_display := 'Sunday Service Rehearsal';
  ELSE
    v_event_display := v_event.title;
  END IF;

  IF NEW.status = 'approved' THEN
    PERFORM create_notification(
      NEW.created_by,
      'setlist_approved',
      'Setlist Approved',
      'Your setlist for ' || v_event_display || ' on ' || v_date_str || ' has been approved.',
      jsonb_build_object('event_id', NEW.event_id::text, 'setlist_id', NEW.id::text, 'url', '/events/' || NEW.event_id::text)
    );
  ELSIF NEW.status = 'revision_requested' THEN
    PERFORM create_notification(
      NEW.created_by,
      'setlist_revision',
      'Revision Requested',
      'Your setlist for ' || v_event_display || ' on ' || v_date_str || ' needs revisions.',
      jsonb_build_object('event_id', NEW.event_id::text, 'setlist_id', NEW.id::text, 'url', '/events/' || NEW.event_id::text)
    );
  ELSIF NEW.status = 'pending_review' THEN
    PERFORM notify_all_except(
      NEW.created_by,
      'setlist_submitted',
      'Setlist Submitted for Review',
      'A setlist for ' || v_event_display || ' on ' || v_date_str || ' is ready for review.',
      jsonb_build_object('event_id', NEW.event_id::text, 'setlist_id', NEW.id::text, 'url', '/events/' || NEW.event_id::text)
    );
  END IF;

  RETURN NEW;
END;
$$;

/*
  # Add Event Date to Notification Bodies

  Updates notification trigger functions to include the event date in
  long form (e.g. "April 26, 2026") using the pattern:
    "{event_title} on {date}"

  1. Modified Functions
    - `on_event_assignment_created()` — body now reads:
        "You have been assigned as {role} for {title} on {date}"
    - `on_assignment_status_changed()` — body now reads:
        "{name} has confirmed/declined their assignment for {title} on {date}"
    - `on_setlist_status_changed()` — bodies now read:
        "Your setlist for {title} on {date} has been approved"
        "Your setlist for {title} on {date} needs revisions"
        "A setlist for {title} on {date} is ready for review"

  2. Date Format
    - Uses TO_CHAR with 'FMMonth FMDD, YYYY' for clean long-form dates
      (e.g. "March 6, 2026" — no leading zeros, no padded month names)

  3. Important Notes
    - No schema changes; only function body replacements
    - All existing notification data remains untouched
*/

-- 1. on_event_assignment_created
CREATE OR REPLACE FUNCTION on_event_assignment_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_title text;
  v_event_date date;
  v_role_name text;
  v_date_str text;
BEGIN
  SELECT title, event_date INTO v_event_title, v_event_date FROM events WHERE id = NEW.event_id;
  SELECT name INTO v_role_name FROM roles WHERE id = NEW.role_id;

  v_date_str := TO_CHAR(v_event_date, 'FMMonth FMDD, YYYY');

  PERFORM create_notification(
    NEW.user_id,
    'assignment',
    'New Assignment',
    'You have been assigned as ' || v_role_name || ' for ' || v_event_title || ' on ' || v_date_str,
    jsonb_build_object('event_id', NEW.event_id::text, 'assignment_id', NEW.id::text, 'url', '/events/' || NEW.event_id::text)
  );
  RETURN NEW;
END;
$$;

-- 2. on_assignment_status_changed
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

  PERFORM create_notification(
    v_event.created_by,
    'assignment_response',
    'Assignment ' || initcap(v_status_text),
    v_user_name || ' has ' || v_status_text || ' their assignment for ' || v_event.title || ' on ' || v_date_str,
    jsonb_build_object('event_id', NEW.event_id::text, 'assignment_id', NEW.id::text, 'url', '/events/' || NEW.event_id::text)
  );
  RETURN NEW;
END;
$$;

-- 3. on_setlist_status_changed
CREATE OR REPLACE FUNCTION on_setlist_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_title text;
  v_event_date date;
  v_date_str text;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT title, event_date INTO v_event_title, v_event_date FROM events WHERE id = NEW.event_id;
  v_date_str := TO_CHAR(v_event_date, 'FMMonth FMDD, YYYY');

  IF NEW.status = 'approved' THEN
    PERFORM create_notification(
      NEW.created_by,
      'setlist_approved',
      'Setlist Approved',
      'Your setlist for ' || v_event_title || ' on ' || v_date_str || ' has been approved',
      jsonb_build_object('event_id', NEW.event_id::text, 'setlist_id', NEW.id::text, 'url', '/events/' || NEW.event_id::text)
    );
  ELSIF NEW.status = 'revision_requested' THEN
    PERFORM create_notification(
      NEW.created_by,
      'setlist_revision',
      'Revision Requested',
      'Your setlist for ' || v_event_title || ' on ' || v_date_str || ' needs revisions',
      jsonb_build_object('event_id', NEW.event_id::text, 'setlist_id', NEW.id::text, 'url', '/events/' || NEW.event_id::text)
    );
  ELSIF NEW.status = 'pending_review' THEN
    PERFORM notify_all_except(
      NEW.created_by,
      'setlist_submitted',
      'Setlist Submitted for Review',
      'A setlist for ' || v_event_title || ' on ' || v_date_str || ' is ready for review',
      jsonb_build_object('event_id', NEW.event_id::text, 'setlist_id', NEW.id::text, 'url', '/events/' || NEW.event_id::text)
    );
  END IF;

  RETURN NEW;
END;
$$;

/*
  # Add URL routing data to notifications and leave request notification trigger

  1. Changes
    - Update `create_notification` helper to accept URL parameter
    - Update all notification trigger functions to include `url` field in data JSON
    - Add new trigger for leave/unavailable day requests to notify leadership
  
  2. Notification URL mapping
    - Event assignments -> /events/{event_id}
    - Setlist changes -> /events/{event_id}
    - Announcements -> /announcements/{announcement_id}
    - Comments -> /announcements/{announcement_id}
    - Videos -> /library
    - Leave requests -> /unavailable-requests

  3. New trigger
    - `on_leave_request_created` fires on INSERT to `user_availability`
    - Notifies all users with leadership roles about the new leave request
*/

-- Update: Assignment created trigger
CREATE OR REPLACE FUNCTION on_event_assignment_created()
RETURNS trigger AS $$
DECLARE
  v_event_title text;
  v_role_name text;
BEGIN
  SELECT title INTO v_event_title FROM events WHERE id = NEW.event_id;
  SELECT name INTO v_role_name FROM roles WHERE id = NEW.role_id;

  PERFORM create_notification(
    NEW.user_id,
    'assignment',
    'New Assignment',
    'You have been assigned as ' || v_role_name || ' for ' || v_event_title,
    jsonb_build_object('event_id', NEW.event_id::text, 'assignment_id', NEW.id::text, 'url', '/events/' || NEW.event_id::text)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Update: Assignment status changed trigger
CREATE OR REPLACE FUNCTION on_assignment_status_changed()
RETURNS trigger AS $$
DECLARE
  v_event record;
  v_user_name text;
  v_status_text text;
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

  PERFORM create_notification(
    v_event.created_by,
    'assignment_response',
    'Assignment ' || initcap(v_status_text),
    v_user_name || ' has ' || v_status_text || ' their assignment for ' || v_event.title,
    jsonb_build_object('event_id', NEW.event_id::text, 'assignment_id', NEW.id::text, 'url', '/events/' || NEW.event_id::text)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Update: Setlist status changed trigger
CREATE OR REPLACE FUNCTION on_setlist_status_changed()
RETURNS trigger AS $$
DECLARE
  v_event_title text;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT title INTO v_event_title FROM events WHERE id = NEW.event_id;

  IF NEW.status = 'approved' THEN
    PERFORM create_notification(
      NEW.created_by,
      'setlist_approved',
      'Setlist Approved',
      'Your setlist for ' || v_event_title || ' has been approved',
      jsonb_build_object('event_id', NEW.event_id::text, 'setlist_id', NEW.id::text, 'url', '/events/' || NEW.event_id::text)
    );
  ELSIF NEW.status = 'revision_requested' THEN
    PERFORM create_notification(
      NEW.created_by,
      'setlist_revision',
      'Revision Requested',
      'Your setlist for ' || v_event_title || ' needs revisions',
      jsonb_build_object('event_id', NEW.event_id::text, 'setlist_id', NEW.id::text, 'url', '/events/' || NEW.event_id::text)
    );
  ELSIF NEW.status = 'pending_review' THEN
    PERFORM notify_all_except(
      NEW.created_by,
      'setlist_submitted',
      'Setlist Submitted for Review',
      'A setlist for ' || v_event_title || ' is ready for review',
      jsonb_build_object('event_id', NEW.event_id::text, 'setlist_id', NEW.id::text, 'url', '/events/' || NEW.event_id::text)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Update: Announcement created trigger
CREATE OR REPLACE FUNCTION on_announcement_created()
RETURNS trigger AS $$
BEGIN
  PERFORM notify_all_except(
    NEW.created_by,
    'announcement',
    'New Announcement: ' || NEW.title,
    LEFT(NEW.content, 200),
    jsonb_build_object('announcement_id', NEW.id::text, 'url', '/announcements/' || NEW.id::text)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Update: Comment created trigger
CREATE OR REPLACE FUNCTION on_comment_created()
RETURNS trigger AS $$
DECLARE
  v_announcement record;
  v_commenter_name text;
BEGIN
  SELECT * INTO v_announcement FROM announcements WHERE id = NEW.announcement_id;
  SELECT first_name || ' ' || last_name INTO v_commenter_name FROM profiles WHERE id = NEW.user_id;

  IF v_announcement.created_by != NEW.user_id THEN
    PERFORM create_notification(
      v_announcement.created_by,
      'comment',
      'New Comment',
      v_commenter_name || ' commented on your announcement: ' || v_announcement.title,
      jsonb_build_object('announcement_id', NEW.announcement_id::text, 'url', '/announcements/' || NEW.announcement_id::text)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Update: Video created trigger
CREATE OR REPLACE FUNCTION on_video_created()
RETURNS trigger AS $$
BEGIN
  PERFORM notify_all_except(
    NEW.uploaded_by,
    'video',
    'New Video: ' || NEW.title,
    COALESCE(LEFT(NEW.description, 200), 'A new video has been uploaded'),
    jsonb_build_object('video_id', NEW.id::text, 'url', '/library')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- NEW: Leave request trigger - notify leadership
CREATE OR REPLACE FUNCTION on_leave_request_created()
RETURNS trigger AS $$
DECLARE
  v_user_name text;
  v_leader record;
BEGIN
  SELECT first_name || ' ' || last_name INTO v_user_name FROM profiles WHERE id = NEW.user_id;

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
      v_user_name || ' requested to be unavailable on ' || to_char(NEW.unavailable_date, 'Mon DD, YYYY') || CASE WHEN NEW.reason IS NOT NULL AND NEW.reason != '' THEN ' -- ' || NEW.reason ELSE '' END,
      jsonb_build_object('leave_id', NEW.id::text, 'user_id', NEW.user_id::text, 'type', 'leave_request', 'url', '/unavailable-requests')
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

DROP TRIGGER IF EXISTS trg_leave_request_created ON user_availability;

CREATE TRIGGER trg_leave_request_created
  AFTER INSERT ON user_availability
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION on_leave_request_created();

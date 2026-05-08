/*
  # Notification Triggers

  Database triggers that automatically create in-app notifications for key events:
  1. New event assignment -> notify assigned user
  2. Assignment status change -> notify event creator
  3. Setlist status change -> notify setlist creator
  4. New announcement -> notify all users
  5. New announcement comment -> notify announcement creator
  6. New video upload -> notify all users

  Also creates a helper function to notify all team members.
*/

-- Helper: create notification for a single user
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_data jsonb DEFAULT '{}'
)
RETURNS void AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (p_user_id, p_type, p_title, p_body, p_data);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: notify all users except one
CREATE OR REPLACE FUNCTION notify_all_except(
  p_exclude_user uuid,
  p_type text,
  p_title text,
  p_body text,
  p_data jsonb DEFAULT '{}'
)
RETURNS void AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, body, data)
  SELECT id, p_type, p_title, p_body, p_data
  FROM profiles
  WHERE id != p_exclude_user;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: New event assignment
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
    jsonb_build_object('event_id', NEW.event_id, 'assignment_id', NEW.id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_event_assignment_created ON event_assignments;
CREATE TRIGGER trg_event_assignment_created
  AFTER INSERT ON event_assignments
  FOR EACH ROW EXECUTE FUNCTION on_event_assignment_created();

-- Trigger: Assignment status changed (confirmed/declined)
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
    jsonb_build_object('event_id', NEW.event_id, 'assignment_id', NEW.id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_assignment_status_changed ON event_assignments;
CREATE TRIGGER trg_assignment_status_changed
  AFTER UPDATE ON event_assignments
  FOR EACH ROW EXECUTE FUNCTION on_assignment_status_changed();

-- Trigger: Setlist status changed
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
      jsonb_build_object('event_id', NEW.event_id, 'setlist_id', NEW.id)
    );
  ELSIF NEW.status = 'revision_requested' THEN
    PERFORM create_notification(
      NEW.created_by,
      'setlist_revision',
      'Revision Requested',
      'Your setlist for ' || v_event_title || ' needs revisions',
      jsonb_build_object('event_id', NEW.event_id, 'setlist_id', NEW.id)
    );
  ELSIF NEW.status = 'pending_review' THEN
    PERFORM notify_all_except(
      NEW.created_by,
      'setlist_submitted',
      'Setlist Submitted for Review',
      'A setlist for ' || v_event_title || ' is ready for review',
      jsonb_build_object('event_id', NEW.event_id, 'setlist_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_setlist_status_changed ON setlists;
CREATE TRIGGER trg_setlist_status_changed
  AFTER UPDATE ON setlists
  FOR EACH ROW EXECUTE FUNCTION on_setlist_status_changed();

-- Trigger: New announcement
CREATE OR REPLACE FUNCTION on_announcement_created()
RETURNS trigger AS $$
BEGIN
  PERFORM notify_all_except(
    NEW.created_by,
    'announcement',
    'New Announcement: ' || NEW.title,
    LEFT(NEW.content, 200),
    jsonb_build_object('announcement_id', NEW.id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_announcement_created ON announcements;
CREATE TRIGGER trg_announcement_created
  AFTER INSERT ON announcements
  FOR EACH ROW EXECUTE FUNCTION on_announcement_created();

-- Trigger: New comment on announcement
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
      jsonb_build_object('announcement_id', NEW.announcement_id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_comment_created ON announcement_comments;
CREATE TRIGGER trg_comment_created
  AFTER INSERT ON announcement_comments
  FOR EACH ROW EXECUTE FUNCTION on_comment_created();

-- Trigger: New video
CREATE OR REPLACE FUNCTION on_video_created()
RETURNS trigger AS $$
BEGIN
  PERFORM notify_all_except(
    NEW.uploaded_by,
    'video',
    'New Video: ' || NEW.title,
    COALESCE(LEFT(NEW.description, 200), 'A new video has been uploaded'),
    jsonb_build_object('video_id', NEW.id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_video_created ON videos;
CREATE TRIGGER trg_video_created
  AFTER INSERT ON videos
  FOR EACH ROW EXECUTE FUNCTION on_video_created();

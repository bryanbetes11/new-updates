/*
  # Fix Comment Notifications: Notify All Thread Participants

  ## Root Cause
  The `on_comment_created()` trigger only notified `announcements.created_by`
  (the announcement author). Since leaders typically create announcements, only
  leadership roles received comment notifications. Non-leadership members who
  participated in comment threads were never notified of new replies.

  ## Fix
  Replace the single-recipient logic with a participant-based approach:
  - Notify the announcement creator (if not the commenter)
  - Notify all distinct prior commenters on the same announcement (if not the commenter)
  - Deduplicate so each person gets at most one notification per comment event

  ## Files Changed
  - This migration only (replaces the on_comment_created function in the DB)
*/

CREATE OR REPLACE FUNCTION on_comment_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_announcement record;
  v_commenter_name text;
  v_recipient_id uuid;
BEGIN
  SELECT * INTO v_announcement FROM announcements WHERE id = NEW.announcement_id;
  SELECT first_name || ' ' || last_name INTO v_commenter_name FROM profiles WHERE id = NEW.user_id;

  -- Collect all unique recipients: announcement creator + prior commenters
  -- excluding the person who just commented
  FOR v_recipient_id IN
    SELECT DISTINCT recipient FROM (
      -- Announcement creator
      SELECT v_announcement.created_by AS recipient
      UNION
      -- All prior commenters on this announcement
      SELECT user_id AS recipient
      FROM announcement_comments
      WHERE announcement_id = NEW.announcement_id
        AND id != NEW.id
    ) sub
    WHERE recipient != NEW.user_id
  LOOP
    PERFORM create_notification(
      v_recipient_id,
      'comment',
      'New Comment',
      v_commenter_name || ' commented on "' || v_announcement.title || '"',
      jsonb_build_object(
        'announcement_id', NEW.announcement_id::text,
        'url', '/announcements/' || NEW.announcement_id::text
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

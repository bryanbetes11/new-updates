/*
  # Fix announcement comment notifications to reach all relevant members

  ## Problem
  The existing `on_comment_created` trigger only notified:
  - The announcement creator
  - Prior commenters on the same announcement

  This meant that if a leader commented first, only the creator/prior commenters were
  notified. Regular members (who hadn't commented) were never notified, and vice versa.

  ## Fix
  Replace the recipient logic so that:
  - For a regular announcement: ALL profiles are notified (except the commenter themselves)
  - For a leaders-only announcement: only profiles that hold a leadership role are notified
    (except the commenter themselves)

  Leadership roles (matching AuthContext): Admin Coordinator, Music Director, Stage Director,
  Production Director, Setlist Coordinator.

  ## Files changed
  - Replaces `on_comment_created()` function body only
  - Trigger `trg_comment_created` is left intact (already correct)
*/

CREATE OR REPLACE FUNCTION on_comment_created()
RETURNS TRIGGER
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

  FOR v_recipient_id IN
    SELECT p.id
    FROM profiles p
    WHERE p.id != NEW.user_id
      AND (
        -- Regular announcement: notify everyone
        v_announcement.is_leaders_only IS NOT TRUE
        OR
        -- Leaders-only announcement: notify only leadership roles
        EXISTS (
          SELECT 1
          FROM user_roles ur
          JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = p.id
            AND r.name IN (
              'Admin Coordinator',
              'Music Director',
              'Stage Director',
              'Production Director',
              'Setlist Coordinator'
            )
        )
      )
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

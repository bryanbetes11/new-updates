/*
  # Announcement & Comment Mention Notifications

  ## Summary
  Adds database trigger functions that detect @First_Last mentions in announcement
  content blocks and announcement comments, then fire in-app + push notifications
  to the mentioned user (excluding self-mentions).

  ## New Functions
  - `extract_mentions(text)` — parses @Word_Word tokens from a text string and
    returns a table of matching profile IDs
  - `on_announcement_comment_mention()` — trigger on INSERT/UPDATE of
    announcement_comments; notifies any mentioned users
  - `on_announcement_mention()` — trigger on INSERT of announcements; scans all
    text content blocks for mentions and notifies mentioned users

  ## New Triggers
  - `trg_announcement_comment_mention` — AFTER INSERT OR UPDATE on
    announcement_comments FOR EACH ROW
  - `trg_announcement_mention` — AFTER INSERT on announcements FOR EACH ROW

  ## Notification Details
  - type: 'mention'
  - title: 'You were mentioned'
  - body: '{CommenterName} mentioned you in a comment / announcement "{Title}"'
  - data.url: '/announcements/{id}'

  ## Notes
  - Mention format stored and parsed: @FirstName_LastName
  - Self-mentions are silently ignored
  - Duplicate notifications within the same insert are avoided via DISTINCT
*/

-- ──────────────────────────────────────────────────────────────
-- Helper: parse @FirstName_LastName tokens and return profile IDs
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION extract_mentions(p_text text)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT p.id
  FROM regexp_matches(p_text, '@([A-Za-z]+)_([A-Za-z]+)', 'g') AS m(parts)
  JOIN profiles p
    ON lower(p.first_name) = lower(m.parts[1])
   AND lower(p.last_name)  = lower(m.parts[2]);
$$;

-- ──────────────────────────────────────────────────────────────
-- Trigger: mentions in announcement COMMENTS
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION on_announcement_comment_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_commenter_name text;
  v_announcement_title text;
  v_mentioned_user_id uuid;
BEGIN
  SELECT first_name || ' ' || last_name
  INTO v_commenter_name
  FROM profiles
  WHERE id = NEW.user_id;

  SELECT title
  INTO v_announcement_title
  FROM announcements
  WHERE id = NEW.announcement_id;

  FOR v_mentioned_user_id IN
    SELECT user_id FROM extract_mentions(NEW.content)
    WHERE user_id <> NEW.user_id
  LOOP
    PERFORM create_notification(
      v_mentioned_user_id,
      'mention',
      'You were mentioned',
      v_commenter_name || ' mentioned you in a comment on "' || v_announcement_title || '".',
      jsonb_build_object(
        'announcement_id', NEW.announcement_id::text,
        'comment_id', NEW.id::text,
        'url', '/announcements/' || NEW.announcement_id::text
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_announcement_comment_mention ON announcement_comments;
CREATE TRIGGER trg_announcement_comment_mention
  AFTER INSERT OR UPDATE OF content ON announcement_comments
  FOR EACH ROW
  EXECUTE FUNCTION on_announcement_comment_mention();

-- ──────────────────────────────────────────────────────────────
-- Trigger: mentions inside announcement content blocks
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION on_announcement_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_name text;
  v_block_text text;
  v_combined_text text := '';
  v_mentioned_user_id uuid;
BEGIN
  SELECT first_name || ' ' || last_name
  INTO v_creator_name
  FROM profiles
  WHERE id = NEW.created_by;

  -- Concatenate all text-type content blocks
  IF NEW.content_blocks IS NOT NULL THEN
    SELECT string_agg(b->>'content', ' ')
    INTO v_combined_text
    FROM jsonb_array_elements(NEW.content_blocks) AS b
    WHERE b->>'type' = 'text';
  END IF;

  -- Also scan plain content field
  v_combined_text := coalesce(v_combined_text, '') || ' ' || coalesce(NEW.content, '');

  FOR v_mentioned_user_id IN
    SELECT user_id FROM extract_mentions(v_combined_text)
    WHERE user_id <> NEW.created_by
  LOOP
    PERFORM create_notification(
      v_mentioned_user_id,
      'mention',
      'You were mentioned',
      v_creator_name || ' mentioned you in the announcement "' || NEW.title || '".',
      jsonb_build_object(
        'announcement_id', NEW.id::text,
        'url', '/announcements/' || NEW.id::text
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_announcement_mention ON announcements;
CREATE TRIGGER trg_announcement_mention
  AFTER INSERT ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION on_announcement_mention();

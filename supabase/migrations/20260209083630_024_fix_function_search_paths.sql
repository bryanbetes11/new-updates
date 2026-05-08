/*
  # Fix Function Search Paths for Security

  1. Security Improvements
    - Set explicit search_path on all functions to prevent search_path injection attacks
    - Ensures functions always use the correct schema
  
  2. Functions Updated
    - create_event_conversation
    - add_assigned_user_to_event_chat
    - is_conversation_member
    - on_video_created
    - create_notification
    - notify_all_except
    - on_event_assignment_created
    - on_assignment_status_changed
    - on_setlist_status_changed
    - on_announcement_created
    - on_comment_created
    - update_conversation_timestamp
*/

-- Fix create_event_conversation
ALTER FUNCTION create_event_conversation() SET search_path = public, pg_temp;

-- Fix add_assigned_user_to_event_chat
ALTER FUNCTION add_assigned_user_to_event_chat() SET search_path = public, pg_temp;

-- Fix is_conversation_member
ALTER FUNCTION is_conversation_member(uuid, uuid) SET search_path = public, pg_temp;

-- Fix on_video_created
ALTER FUNCTION on_video_created() SET search_path = public, pg_temp;

-- Fix create_notification
ALTER FUNCTION create_notification(uuid, text, text, text, jsonb) SET search_path = public, pg_temp;

-- Fix notify_all_except
ALTER FUNCTION notify_all_except(uuid, text, text, text, jsonb) SET search_path = public, pg_temp;

-- Fix on_event_assignment_created
ALTER FUNCTION on_event_assignment_created() SET search_path = public, pg_temp;

-- Fix on_assignment_status_changed
ALTER FUNCTION on_assignment_status_changed() SET search_path = public, pg_temp;

-- Fix on_setlist_status_changed
ALTER FUNCTION on_setlist_status_changed() SET search_path = public, pg_temp;

-- Fix on_announcement_created
ALTER FUNCTION on_announcement_created() SET search_path = public, pg_temp;

-- Fix on_comment_created
ALTER FUNCTION on_comment_created() SET search_path = public, pg_temp;

-- Fix update_conversation_timestamp
ALTER FUNCTION update_conversation_timestamp() SET search_path = public, pg_temp;

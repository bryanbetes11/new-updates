/*
  # Add profiles FK for event_messages PostgREST embedding

  1. Changes
    - Add FK from event_messages.user_id to profiles.id
    - This enables PostgREST to resolve `profiles()` joins on event_messages

  2. Notes
    - profiles.id = auth.users.id, so this FK is safe
    - Required for the EventDiscussion component to fetch sender profile data
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'event_messages_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE event_messages 
    ADD CONSTRAINT event_messages_user_id_profiles_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
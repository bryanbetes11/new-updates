/*
  # Add profiles FK references for PostgREST embedding

  1. Changes
    - Add FK from messages.sender_id to profiles.id (for PostgREST embedding)
    - Add FK from conversation_members.user_id to profiles.id (for PostgREST embedding)
    - These are secondary FKs alongside the existing auth.users FKs

  2. Notes
    - profiles.id = auth.users.id, so these FKs are safe
    - Required for PostgREST resource embedding to resolve profiles() joins
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'messages_sender_id_profiles_fkey'
  ) THEN
    ALTER TABLE messages 
    ADD CONSTRAINT messages_sender_id_profiles_fkey 
    FOREIGN KEY (sender_id) REFERENCES profiles(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'conversation_members_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE conversation_members 
    ADD CONSTRAINT conversation_members_user_id_profiles_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(id);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

/*
  # Add profiles FK for message_reactions PostgREST joins

  Adds a foreign key reference from message_reactions.user_id to profiles.id
  to enable PostgREST joins with the profiles table.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'message_reactions_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE message_reactions
      ADD CONSTRAINT message_reactions_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES profiles(id);
  END IF;
END $$;

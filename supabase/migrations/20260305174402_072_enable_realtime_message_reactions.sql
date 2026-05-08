/*
  # Enable Realtime for Message Reactions

  1. Changes
    - Add message_reactions table to realtime publication
    - This ensures emoji reactions update in real-time for all users

  2. Purpose
    - When a user adds/removes a reaction, other users see it instantly
    - No page refresh required to see updated reactions
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
  END IF;
END $$;

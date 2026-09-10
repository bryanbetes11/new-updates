-- Live chart viewers already subscribe to these tables. Keep existing RLS policies.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'setlist_songs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.setlist_songs;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'songs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.songs;
  END IF;
END
$$;

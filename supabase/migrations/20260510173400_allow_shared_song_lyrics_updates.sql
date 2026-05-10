/*
  # Allow shared lyrics updates on songs

  1. Any authenticated user can update the lyrics field on songs
  2. Only the original creator can change other song fields
*/

DROP POLICY IF EXISTS "Authenticated users can update song lyrics" ON public.songs;

CREATE POLICY "Authenticated users can update song lyrics"
  ON public.songs
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE OR REPLACE FUNCTION public.guard_song_updates()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (select auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF OLD.created_by = (select auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF
    NEW.title IS DISTINCT FROM OLD.title OR
    NEW.artist IS DISTINCT FROM OLD.artist OR
    NEW.song_key IS DISTINCT FROM OLD.song_key OR
    NEW.duration IS DISTINCT FROM OLD.duration OR
    NEW.youtube_url IS DISTINCT FROM OLD.youtube_url OR
    NEW.created_by IS DISTINCT FROM OLD.created_by OR
    NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Only lyrics can be updated for songs created by other users';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_song_updates ON public.songs;

CREATE TRIGGER guard_song_updates
BEFORE UPDATE ON public.songs
FOR EACH ROW
EXECUTE FUNCTION public.guard_song_updates();

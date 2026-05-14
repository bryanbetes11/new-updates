alter table public.songs
  add column if not exists chordpro_text text;

comment on column public.songs.chordpro_text is
  'Original ChordPro chart text imported from songbook files and used for chords-over-lyrics rendering.';

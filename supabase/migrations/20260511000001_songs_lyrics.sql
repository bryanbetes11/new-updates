-- Add lyrics column to songs table for shared lyrics storage
alter table public.songs add column if not exists lyrics text;

-- Index for quick check whether lyrics exist
create index if not exists songs_lyrics_not_null_idx
  on public.songs(id) where lyrics is not null;

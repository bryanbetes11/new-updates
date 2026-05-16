alter table public.setlist_songs
  add column if not exists arrangement_chordpro_text text,
  add column if not exists arrangement_section_order text[];

comment on column public.setlist_songs.arrangement_chordpro_text is
  'Deprecated event-specific full chart override. Prefer arrangement_section_order so library chord edits continue to sync.';

comment on column public.setlist_songs.arrangement_section_order is
  'Optional event-specific section order codes such as V1,C1,V1,C1. When null, use the library chart order.';

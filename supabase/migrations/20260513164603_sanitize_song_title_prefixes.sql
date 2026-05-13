-- Remove accidental member honorific prefixes from song titles.

alter table public.songs disable trigger guard_song_updates;

update public.songs
set title = trim(
  replace(
    replace(
      replace(
        replace(
          replace(
            regexp_replace(title, '(Bro\.?|Sis\.?|Brother|Sister)\s*', '', 'gi'),
            'ItaTanghal',
            'Itatanghal'
          ),
          'IStand',
          'I Stand'
        ),
        'STand',
        'Stand'
      ),
      'KatapaTan',
      'Katapatan'
    ),
    'Katapan',
    'Katapatan'
  )
)
where title ~* '(Bro\.?|Sis\.?|Brother|Sister)';

update public.songs
set title = replace(replace(title, 'KatapaTan', 'Katapatan'), 'Katapan', 'Katapatan')
where title like '%KatapaTan%' or title like '%Katapan%';

update public.songs
set title = replace(title, 'STand', 'Stand')
where title like '%STand%';

update public.songs
set title = replace(replace(replace(title, 'ItaTanghal', 'Itatanghal'), 'IStand', 'I Stand'), 'In Awe', 'in Awe')
where title like '%ItaTanghal%' or title like '%IStand%' or title like '%In Awe%';

alter table public.songs enable trigger guard_song_updates;

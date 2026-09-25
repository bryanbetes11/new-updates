-- Remove unused free-text fields whose row policies exposed them too broadly.
-- Abort if substantive content appears before this migration is applied.
do $$
begin
  if exists (
    select 1 from public.profiles
    where nullif(btrim(leadership_notes), '') is not null
  ) or exists (
    select 1 from public.discipline_records
    where nullif(btrim(leader_notes), '') is not null
  ) then
    raise exception 'Internal leadership notes contain data; review and migrate them before removing these columns';
  end if;
end;
$$;

alter table public.profiles drop column leadership_notes;
alter table public.discipline_records drop column leader_notes;

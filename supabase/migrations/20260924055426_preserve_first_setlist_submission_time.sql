-- submitted_at has always represented the first proposal submission. Older
-- clients could overwrite it on resubmission; keep its first recorded value.
-- This migration does not backfill or change existing setlist rows.
create or replace function public.set_submitted_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'pending_review' then
      new.submitted_at := now();
    end if;
    return new;
  end if;

  if old.submitted_at is not null then
    new.submitted_at := old.submitted_at;
  elsif new.status = 'pending_review'
    and old.status is distinct from 'pending_review' then
    new.submitted_at := now();
  else
    new.submitted_at := old.submitted_at;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_set_submitted_at on public.setlists;
create trigger trg_set_submitted_at
  before insert or update of status, submitted_at on public.setlists
  for each row execute function public.set_submitted_at();

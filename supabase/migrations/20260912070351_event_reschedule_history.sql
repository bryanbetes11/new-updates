alter table public.events
  add column rescheduled_from_date date,
  add column rescheduled_from_start_time time,
  add column rescheduled_from_end_time time,
  add column rescheduled_at timestamptz;

-- Capture the previous schedule in the same update as the new schedule.
-- Existing event RLS governs access; this trigger needs no elevated privileges.
create or replace function private.capture_event_reschedule()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if row(old.event_date, old.start_time, old.end_time)
    is distinct from row(new.event_date, new.start_time, new.end_time) then
    new.rescheduled_from_date := old.event_date;
    new.rescheduled_from_start_time := old.start_time;
    new.rescheduled_from_end_time := old.end_time;
    new.rescheduled_at := now();
  else
    new.rescheduled_from_date := old.rescheduled_from_date;
    new.rescheduled_from_start_time := old.rescheduled_from_start_time;
    new.rescheduled_from_end_time := old.rescheduled_from_end_time;
    new.rescheduled_at := old.rescheduled_at;
  end if;
  return new;
end;
$$;

create trigger events_capture_reschedule
before update on public.events
for each row execute function private.capture_event_reschedule();

revoke all on function private.capture_event_reschedule() from public, anon, authenticated;

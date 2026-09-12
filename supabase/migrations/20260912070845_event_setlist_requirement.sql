alter table public.events add column setlist_required boolean not null default true;

create function private.enforce_event_setlist_requirement()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not new.setlist_required then new.proposal_due_date := null; end if;
  return new;
end;
$$;
create trigger events_setlist_requirement before insert or update on public.events
for each row execute function private.enforce_event_setlist_requirement();
revoke all on function private.enforce_event_setlist_requirement() from public, anon, authenticated;

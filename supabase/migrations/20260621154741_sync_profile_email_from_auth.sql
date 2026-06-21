-- Keep public.profiles.email aligned with the confirmed auth.users email.
-- Supabase Auth updates auth.users after email-change confirmation, but our
-- profile row is separate app data and needs to be synced explicitly.

create or replace function public.sync_profile_email_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null and new.email is distinct from old.email then
    update public.profiles
    set
      email = lower(new.email),
      updated_at = now()
    where id = new.id
      and email is distinct from lower(new.email);
  end if;

  return new;
end;
$$;

revoke all on function public.sync_profile_email_from_auth() from public;
revoke all on function public.sync_profile_email_from_auth() from anon;
revoke all on function public.sync_profile_email_from_auth() from authenticated;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.sync_profile_email_from_auth();

update public.profiles p
set
  email = lower(u.email),
  updated_at = now()
from auth.users u
where p.id = u.id
  and u.email is not null
  and p.email is distinct from lower(u.email);

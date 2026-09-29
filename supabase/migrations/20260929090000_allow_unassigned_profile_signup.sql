-- New auth users have a profile before they belong to a church. The tenant
-- activity log requires org_id, so skip only that initial unassigned insert.
-- Profile changes for members who already have a church keep their audit log.
drop trigger if exists trg_activity_profiles on public.profiles;

create trigger trg_activity_profiles_insert
after insert on public.profiles
for each row when (new.org_id is not null)
execute function public.log_activity('account', 'profile');

create trigger trg_activity_profiles_update
after update on public.profiles
for each row
execute function public.log_activity('account', 'profile');

create trigger trg_activity_profiles_delete
after delete on public.profiles
for each row
execute function public.log_activity('account', 'profile');

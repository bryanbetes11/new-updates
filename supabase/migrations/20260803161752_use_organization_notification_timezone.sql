-- Make organization timezone settings operational for new members and birthdays.

create or replace function private.seed_profile_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.org_id is not null then
    insert into public.notification_preferences (user_id, org_id, timezone)
    values (
      new.id,
      new.org_id,
      coalesce(
        (select settings.default_timezone
         from public.notification_system_settings settings
         where settings.org_id = new.org_id),
        'Asia/Manila'
      )
    )
    on conflict (user_id) do update set org_id = excluded.org_id;
  end if;
  return new;
end;
$$;

create or replace function private.create_birthday_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_created integer := 0;
begin
  with birthday_people as (
    select
      profile.id,
      profile.org_id,
      coalesce(nullif(btrim(profile.first_name), ''), 'A teammate') as first_name,
      settings.default_timezone
    from public.profiles profile
    join public.notification_system_settings settings on settings.org_id = profile.org_id
    where profile.birthday is not null
      and to_char(now() at time zone settings.default_timezone, 'HH24') = '08'
      and to_char(profile.birthday, 'MM-DD') = to_char((now() at time zone settings.default_timezone)::date, 'MM-DD')
  ), inserted as (
    insert into public.notifications (user_id, org_id, type, title, body, data)
    select
      recipient.id,
      birthday_person.org_id,
      'birthday',
      'Birthday Today',
      'Today is ' || birthday_person.first_name || '''s birthday!',
      jsonb_build_object(
        'member_id', birthday_person.id::text,
        'member_name', birthday_person.first_name,
        'url', '/events',
        'dedupe_key', 'birthday:' || birthday_person.id::text || ':' || to_char((now() at time zone birthday_person.default_timezone)::date, 'YYYY-MM-DD')
      )
    from birthday_people birthday_person
    join public.profiles recipient
      on recipient.org_id = birthday_person.org_id
     and recipient.id <> birthday_person.id
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing
    returning 1
  )
  select count(*) into v_created from inserted;
  return v_created;
end;
$$;

do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'servesync-birthday-notifications';

  perform cron.schedule(
    'servesync-birthday-notifications',
    '0 * * * *',
    'select private.create_birthday_notifications();'
  );
end;
$$;

revoke all on function private.seed_profile_notification_preferences() from public, anon, authenticated;
revoke all on function private.create_birthday_notifications() from public, anon, authenticated;

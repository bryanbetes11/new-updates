# Multi-Tenant Verification Checks

Run these checks after applying:

- `20260502000200_add_org_id_columns_to_tenant_tables.sql`
- `20260502000300_seed_mcjc_organization.sql`
- `20260502000400_backfill_mcjc_org_id.sql`

Expected result for all null and mismatch checks: `0`.

## Null Checks

```sql
select 'profiles' as table_name, count(*) as null_org_rows from public.profiles where org_id is null
union all
select 'user_roles', count(*) from public.user_roles where org_id is null
union all
select 'events', count(*) from public.events where org_id is null
union all
select 'event_assignments', count(*) from public.event_assignments where org_id is null
union all
select 'songs', count(*) from public.songs where org_id is null
union all
select 'setlists', count(*) from public.setlists where org_id is null
union all
select 'setlist_songs', count(*) from public.setlist_songs where org_id is null
union all
select 'announcements', count(*) from public.announcements where org_id is null
union all
select 'announcement_comments', count(*) from public.announcement_comments where org_id is null
union all
select 'announcement_views', count(*) from public.announcement_views where org_id is null
union all
select 'videos', count(*) from public.videos where org_id is null
union all
select 'notifications', count(*) from public.notifications where org_id is null
union all
select 'push_subscriptions', count(*) from public.push_subscriptions where org_id is null
union all
select 'user_availability', count(*) from public.user_availability where org_id is null
union all
select 'user_preferences', count(*) from public.user_preferences where org_id is null
union all
select 'conversations', count(*) from public.conversations where org_id is null
union all
select 'conversation_members', count(*) from public.conversation_members where org_id is null
union all
select 'messages', count(*) from public.messages where org_id is null
union all
select 'event_messages', count(*) from public.event_messages where org_id is null
union all
select 'message_reactions', count(*) from public.message_reactions where org_id is null
union all
select 'event_attendance', count(*) from public.event_attendance where org_id is null
union all
select 'attendance_offense_notifications', count(*) from public.attendance_offense_notifications where org_id is null
union all
select 'discipline_records', count(*) from public.discipline_records where org_id is null
union all
select 'setlist_checker_results', count(*) from public.setlist_checker_results where org_id is null
union all
select 'setlist_checker_sessions', count(*) from public.setlist_checker_sessions where org_id is null
union all
select 'announcement_reactions', count(*) from public.announcement_reactions where org_id is null
union all
select 'announcement_pins', count(*) from public.announcement_pins where org_id is null
union all
select 'setlist_reminders', count(*) from public.setlist_reminders where org_id is null;
```

## Parent / Child Org Mismatch Checks

```sql
select 'event_assignments -> events' as relation_name, count(*) as mismatches
from public.event_assignments ea
join public.events e on e.id = ea.event_id
where ea.org_id is distinct from e.org_id
union all
select 'setlists -> events', count(*)
from public.setlists sl
join public.events e on e.id = sl.event_id
where sl.org_id is distinct from e.org_id
union all
select 'setlist_songs -> setlists', count(*)
from public.setlist_songs ss
join public.setlists sl on sl.id = ss.setlist_id
where ss.org_id is distinct from sl.org_id
union all
select 'announcement_comments -> announcements', count(*)
from public.announcement_comments ac
join public.announcements a on a.id = ac.announcement_id
where ac.org_id is distinct from a.org_id
union all
select 'announcement_views -> announcements', count(*)
from public.announcement_views av
join public.announcements a on a.id = av.announcement_id
where av.org_id is distinct from a.org_id
union all
select 'announcement_reactions -> announcements', count(*)
from public.announcement_reactions ar
join public.announcements a on a.id = ar.announcement_id
where ar.org_id is distinct from a.org_id
union all
select 'announcement_pins -> announcements', count(*)
from public.announcement_pins ap
join public.announcements a on a.id = ap.announcement_id
where ap.org_id is distinct from a.org_id
union all
select 'conversation_members -> conversations', count(*)
from public.conversation_members cm
join public.conversations c on c.id = cm.conversation_id
where cm.org_id is distinct from c.org_id
union all
select 'messages -> conversations', count(*)
from public.messages m
join public.conversations c on c.id = m.conversation_id
where m.org_id is distinct from c.org_id
union all
select 'message_reactions -> messages', count(*)
from public.message_reactions mr
join public.messages m on m.id = mr.message_id
where mr.org_id is distinct from m.org_id
union all
select 'event_messages -> events', count(*)
from public.event_messages em
join public.events e on e.id = em.event_id
where em.org_id is distinct from e.org_id
union all
select 'event_attendance -> events', count(*)
from public.event_attendance att
join public.events e on e.id = att.event_id
where att.org_id is distinct from e.org_id
union all
select 'setlist_reminders -> events', count(*)
from public.setlist_reminders sr
join public.events e on e.id = sr.event_id
where sr.org_id is distinct from e.org_id;
```

## One-Tenant Sanity Check

```sql
select org_id, count(*) as profile_count
from public.profiles
group by org_id
order by profile_count desc;
```

```sql
select slug, name, created_by, subscription_status
from public.organizations
where slug = 'mcjc-church';
```

## Key Table Row Counts By Org

```sql
select 'profiles' as table_name, org_id, count(*) from public.profiles group by org_id
union all
select 'events', org_id, count(*) from public.events group by org_id
union all
select 'announcements', org_id, count(*) from public.announcements group by org_id
union all
select 'conversations', org_id, count(*) from public.conversations group by org_id
union all
select 'messages', org_id, count(*) from public.messages group by org_id
order by table_name, org_id;
```

## MCJC Admin Check

```sql
select email, is_org_admin, org_id
from public.profiles
where lower(email) = 'bryanbetes11@gmail.com';
```

## Visible App Smoke Test

After the SQL checks pass, verify in the UI:

- member login works
- leader/admin login works
- dashboard loads
- events list and event detail load
- announcements load
- messaging loads
- leadership pages still load
- creating or editing an event still works

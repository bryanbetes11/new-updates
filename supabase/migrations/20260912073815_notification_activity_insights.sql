-- Aggregate on the server; totals cover the full period, not just the visible page.
-- SECURITY INVOKER preserves same-organization admin-only activity RLS.
create or replace function public.get_notification_activity_insights(
  p_since timestamptz, p_type text default null, p_focus text default 'all',
  p_offset integer default 0, p_group uuid default null)
returns jsonb language sql stable security invoker set search_path = '' as $$
with period as (
  select a.*, (push_opened_at is not null or bell_opened_at is not null or page_opened_at is not null) as opened,
    push_status in ('failed','no_subscription','partial') as issue
  from public.notification_activity a
  where a.created_at >= greatest(coalesce(p_since, now()-interval '30 days'), now()-interval '366 days')
    and a.created_at <= now()
), filtered as (
  select * from period where (p_type is null or notification_type=p_type)
    and (p_group is null or group_id=p_group)
), grouped as (
  select group_id, min(title) title, min(notification_type) notification_type, min(created_at) created_at,
    count(*) recipient_count, count(*) filter(where opened) opened_count,
    count(*) filter(where push_status in ('sent','partial')) accepted_count,
    count(*) filter(where issue) issue_count
  from filtered group by group_id
), matching as (
  select * from grouped where p_focus='all'
    or (p_focus='unopened' and opened_count<recipient_count)
    or (p_focus='issues' and issue_count>0)
), paged as (
  select * from matching order by created_at desc,group_id
  limit 25 offset greatest(0,least(coalesce(p_offset,0),100000))
)
select jsonb_build_object(
  'summary', (select jsonb_build_object(
    'notification_count',count(*),'member_count',count(distinct user_id),
    'opened_count',count(*) filter(where opened),
    'accepted_count',count(*) filter(where push_status in ('sent','partial')),
    'issue_count',count(*) filter(where issue),
    'failed_count',count(*) filter(where push_status='failed'),
    'no_device_count',count(*) filter(where push_status='no_subscription'),
    'partial_count',count(*) filter(where push_status='partial'),
    'pending_count',count(*) filter(where push_status in ('pending','deferred','dispatching')),
    'push_opened_count',count(*) filter(where push_opened_at is not null),
    'bell_opened_count',count(*) filter(where bell_opened_at is not null),
    'page_opened_count',count(*) filter(where page_opened_at is not null)
  ) from filtered),
  'types',coalesce((select jsonb_agg(t.notification_type order by t.notification_type) from (select distinct notification_type from period) t),'[]'::jsonb),
  'groups',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc,p.group_id) from paged p),'[]'::jsonb),
  'matching_groups',(select count(*) from matching)
);
$$;
revoke all on function public.get_notification_activity_insights(timestamptz,text,text,integer,uuid) from public,anon;
grant execute on function public.get_notification_activity_insights(timestamptz,text,text,integer,uuid) to authenticated;

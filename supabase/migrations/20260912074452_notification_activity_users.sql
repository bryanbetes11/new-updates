create or replace function public.get_notification_activity_users(
 p_since timestamptz, p_search text default '', p_offset integer default 0)
returns jsonb language sql stable security invoker set search_path='' as $$
with activity as (
 select user_id,count(*) notification_count,
 count(*) filter(where push_opened_at is not null or bell_opened_at is not null or page_opened_at is not null) clicked_count,
 count(*) filter(where push_status in ('sent','partial')) accepted_count,
 count(*) filter(where push_status in ('failed','no_subscription','partial')) issue_count,
 max(created_at) last_notification_at
 from public.notification_activity
 where created_at >= greatest(coalesce(p_since,now()-interval '30 days'),now()-interval '366 days') and created_at <= now()
 group by user_id
), named as (
 select a.*,coalesce(nullif(trim(concat(p.first_name,' ',p.last_name)),''),'Member unavailable') display_name
 from activity a left join public.profiles p on p.id=a.user_id
), matching as (
 select * from named where position(lower(coalesce(p_search,'')) in lower(display_name))>0
), paged as (
 select * from matching order by lower(display_name),user_id limit 25 offset greatest(0,least(coalesce(p_offset,0),100000))
)
select jsonb_build_object('users',coalesce((select jsonb_agg(to_jsonb(p) order by lower(display_name),user_id) from paged p),'[]'::jsonb),
 'total',(select count(*) from matching));
$$;
revoke all on function public.get_notification_activity_users(timestamptz,text,integer) from public,anon;
grant execute on function public.get_notification_activity_users(timestamptz,text,integer) to authenticated;

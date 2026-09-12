alter table public.notification_activity add column event_id uuid, add column event_viewed_at timestamptz;
create index notification_activity_event_user_idx on public.notification_activity(event_id,user_id);
create or replace function private.capture_notification_event_context()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_id text;
begin
 select data->>'event_id' into v_id from public.notifications where id=new.notification_id and org_id=new.org_id and user_id=new.user_id;
 if v_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
   if exists(select 1 from public.events where id=v_id::uuid and org_id=new.org_id) then new.event_id:=v_id::uuid; end if;
 end if;
 return new;
end; $$;
revoke all on function private.capture_notification_event_context() from public,anon,authenticated;
create trigger notification_activity_event_context before insert on public.notification_activity for each row execute function private.capture_notification_event_context();
-- Restore context only, never invent historical views.
update public.notification_activity a set event_id=e.id
from public.notifications n join public.events e on e.id::text=n.data->>'event_id' and e.org_id=n.org_id
where n.id=a.notification_id and n.org_id=a.org_id and n.user_id=a.user_id;

create or replace function public.record_event_update_view(p_event_id uuid,p_rescheduled_at timestamptz)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_event public.events%rowtype;
begin
 if auth.uid() is null then return false; end if;
 select * into v_event from public.events where id=p_event_id and org_id=public.auth_org_id();
 if not found or v_event.rescheduled_at is distinct from p_rescheduled_at then return false; end if;
 if not exists(select 1 from public.event_assignments where event_id=p_event_id and user_id=auth.uid()) then return false; end if;
 update public.notification_activity set event_viewed_at=coalesce(event_viewed_at,now())
 where event_id=p_event_id and user_id=auth.uid() and org_id=public.auth_org_id()
 and created_at>=coalesce(v_event.rescheduled_at,'-infinity'::timestamptz) and created_at<=now()
 and notification_type in ('event_rescheduled','assignment','event_invitation','assignment_confirmation_reminder','event_invitation_reminder','event_updated');
 return true;
end; $$;
revoke all on function public.record_event_update_view(uuid,timestamptz) from public,anon;
grant execute on function public.record_event_update_view(uuid,timestamptz) to authenticated;

create or replace view public.notification_activity_outcomes with (security_invoker=true) as
select a.*,
 case
 when a.event_id is null or a.notification_type not in ('event_rescheduled','assignment','event_invitation','assignment_confirmation_reminder','event_invitation_reminder','event_updated') then null
 when e.id is null then 'unavailable'
 when e.rescheduled_at>a.created_at then 'superseded'
 when s.total=0 then 'no_assignment'
 when s.pending>0 then 'awaiting_response'
 when s.confirmed=s.total then 'confirmed'
 when s.declined=s.total then 'declined'
 else 'responded'
 end as response_status
from public.notification_activity a
left join public.events e on e.id=a.event_id and e.org_id=a.org_id
left join lateral (
 select count(*) total,count(*) filter(where status='pending') pending,
 count(*) filter(where status='confirmed') confirmed,count(*) filter(where status='declined') declined
 from public.event_assignments ea where ea.event_id=a.event_id and ea.user_id=a.user_id
) s on true;
revoke all on public.notification_activity_outcomes from public,anon;
grant select on public.notification_activity_outcomes to authenticated;
create or replace function public.get_notification_activity_users(
 p_since timestamptz, p_search text default '', p_offset integer default 0)
returns jsonb language sql stable security invoker set search_path='' as $$
with activity as (
 select user_id,count(*) notification_count,
 count(*) filter(where push_opened_at is not null or bell_opened_at is not null or page_opened_at is not null) clicked_count,
 count(*) filter(where push_status in ('sent','partial')) accepted_count,
 count(*) filter(where push_status in ('failed','no_subscription','partial')) issue_count,
 count(*) filter(where response_status='awaiting_response') needs_response_count,
 count(*) filter(where response_status in ('confirmed','declined','responded')) responded_count,
 count(*) filter(where event_viewed_at is not null and response_status<>'superseded') viewed_count,
 max(created_at) last_notification_at
 from public.notification_activity_outcomes
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

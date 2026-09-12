create function private.notification_variants()
returns table(parent_type text, type text, label text, description text)
language sql immutable set search_path = '' as $$
values ('assignment','event_invitation','Event invitation','A member is invited to attend an event.'),
('assignment_confirmation_reminder','event_invitation_reminder','Event invitation reminder','An invited member still needs to confirm attendance.'),
('assignment_response','assignment_confirmed','Assignment confirmed','A serving assignment is accepted.'),
('assignment_response','assignment_declined','Assignment declined','A serving assignment is declined.'),
('assignment_response','event_invitation_accepted','Event invitation accepted','An invited member confirms attendance.'),
('assignment_response','event_invitation_declined','Event invitation declined','An invited member declines attendance.'),
('leave_response','leave_approved','Unavailable day approved','An unavailable day request is approved.'),
('leave_response','leave_declined','Unavailable day declined','An unavailable day request is declined.'),
('role_changed','role_added','Ministry role added','A ministry role is added to a member.'),
('role_changed','role_removed','Ministry role removed','A ministry role is removed from a member.'),
('mention','announcement_mention','Mention in announcement','A member is mentioned in an announcement.'),
('mention','announcement_comment_mention','Mention in announcement comment','A member is mentioned in an announcement comment.'),
('mention','chat_mention','Mention in chat','A member is mentioned in Messenger.'),
('mention','setlist_revision_mention','Mention in setlist discussion','A member is mentioned in a setlist revision discussion.'),
('featured_event_created','revamp_event_created','Revamp scheduled','A Revamp Session is scheduled.'),
('featured_event_created','youth_event_created','Youth Recharge scheduled','A Youth Recharge event is scheduled.'),
('post_event_observation_due','observation_due_tomorrow','Observation due tomorrow','An assigned observation follow-up is due tomorrow.'),
('post_event_observation_due','observation_due_today','Observation due today','An assigned observation follow-up is due today.'),
('post_event_observation_due','observation_overdue','Observation overdue','An assigned observation follow-up is overdue.'),
('post_event_observation_status_changed','observation_resolved','Observation resolved','An observation is resolved.'),
('post_event_observation_status_changed','observation_monitoring','Observation being monitored','An observation is being monitored.'),
('post_event_observation_status_changed','observation_open','Observation opened again','An observation returns to open status.');
$$;

create function private.classify_notification(p_type text, p_data jsonb)
returns text language sql immutable set search_path = '' as $$
select case
 when p_type='assignment' and p_data->>'response_kind'='attendance' then 'event_invitation'
 when p_type='assignment_confirmation_reminder' and p_data->>'response_kind'='attendance' then 'event_invitation_reminder'
 when p_type='assignment_response' and p_data->>'status' in ('confirmed','declined') then
   case when p_data->>'response_kind'='attendance' then
     case when p_data->>'status'='confirmed' then 'event_invitation_accepted' else 'event_invitation_declined' end
   else case when p_data->>'status'='confirmed' then 'assignment_confirmed' else 'assignment_declined' end end
 when p_type='leave_response' and p_data->>'status'='approved' then 'leave_approved'
 when p_type='leave_response' and p_data->>'status'='rejected' then 'leave_declined'
 when p_type='role_changed' and p_data->>'action'='added' then 'role_added'
 when p_type='role_changed' and p_data->>'action'='removed' then 'role_removed'
 when p_type='mention' then case
   when p_data ? 'setlist_id' then 'setlist_revision_mention'
   when p_data ? 'announcement_id' and p_data ? 'comment_id' then 'announcement_comment_mention'
   when p_data ? 'announcement_id' then 'announcement_mention'
   when p_data ? 'conversation_id' then 'chat_mention' else p_type end
 when p_type='featured_event_created' and p_data->>'event_type'='Revamp Session' then 'revamp_event_created'
 when p_type='featured_event_created' and p_data->>'event_type'='Youth Recharge' then 'youth_event_created'
 when p_type='post_event_observation_due' then case p_data->>'reminder_kind'
   when 'due_soon' then 'observation_due_tomorrow' when 'due_today' then 'observation_due_today'
   when 'overdue' then 'observation_overdue' else p_type end
 when p_type='post_event_observation_status_changed' then case p_data->>'observation_status'
   when 'resolved' then 'observation_resolved' when 'monitoring' then 'observation_monitoring'
   when 'open' then 'observation_open' else p_type end
 else p_type end;
$$;

-- Run before notification configuration and delivery, so the independent rule wins.
create function private.classify_notification_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 new.type := private.classify_notification(new.type, coalesce(new.data,'{}'::jsonb));
 return new;
end;
$$;
create trigger aa_classify_notification before insert on public.notifications
for each row execute function private.classify_notification_insert();

-- Preserve existing org controls and custom text when splitting a rule.
create function private.seed_notification_variants(p_org uuid)
returns void language sql security definer set search_path = '' as $$
insert into public.notification_rules(org_id,type,label,category,description,target_roles,enabled,required,in_app_enabled,push_enabled,priority,reminder_offsets,template_title,template_body)
select p_org,v.type,v.label,coalesce(r.category,d.category,'events'),v.description,
 coalesce(r.target_roles,d.target_roles,array['Members']),coalesce(r.enabled,d.enabled,true),
 coalesce(r.required,d.required,false),coalesce(r.in_app_enabled,d.in_app_enabled,true),
 coalesce(r.push_enabled,d.push_enabled,true),coalesce(r.priority,d.priority,'normal'),
 coalesce(r.reminder_offsets,d.reminder_offsets,'{}'::integer[]),r.template_title,r.template_body
from private.notification_variants() v
left join public.notification_rules r on r.org_id=p_org and r.type=v.parent_type
left join private.default_notification_rules() d on d.type=v.parent_type
on conflict(org_id,type) do nothing;
$$;
select private.seed_notification_variants(id) from public.organizations;

-- Keep compatibility settings visible without suggesting they control the new types.
update public.notification_rules set description = case type
 when 'assignment_response' then 'Fallback for responses without decision details. Use Assignment confirmed/declined or Event invitation accepted/declined for normal responses.'
 when 'leave_response' then 'Fallback for leave responses without a decision. Use Unavailable day approved or declined for normal decisions.'
 when 'role_changed' then 'Fallback for role changes without an action. Use Ministry role added or removed for normal changes.'
 when 'mention' then 'Fallback for mentions without a location. Announcement, comment, chat and setlist mentions have separate controls.'
 when 'featured_event_created' then 'Fallback for other featured events. Revamp and Youth Recharge have separate scheduled-event controls.'
 when 'post_event_observation_due' then 'Fallback for follow-ups without a reminder stage. Tomorrow, today and overdue have separate controls.'
 when 'post_event_observation_status_changed' then 'Fallback for other observation statuses. Open, monitoring and resolved have separate controls.'
 else description end
where type in ('assignment_response','leave_response','role_changed','mention','featured_event_created','post_event_observation_due','post_event_observation_status_changed');

create function private.seed_new_org_notification_variants()
returns trigger language plpgsql security definer set search_path = '' as $$
begin perform private.seed_notification_variants(new.id); return new; end;
$$;
create trigger zzzz_seed_notification_variants after insert on public.organizations
for each row execute function private.seed_new_org_notification_variants();

update public.notification_preferences p
set muted_types = array(select distinct t from unnest(coalesce(p.muted_types,'{}'::text[]) ||
 array(select v.type from private.notification_variants() v where v.parent_type=any(coalesce(p.muted_types,'{}'::text[])))) t)
where exists(select 1 from private.notification_variants() v where v.parent_type=any(coalesce(p.muted_types,'{}'::text[])));

-- Give the classifier a stable decision field, independent of customized text.
do $migration$
declare definition text := pg_get_functiondef('public.on_assignment_status_changed()'::regprocedure);
begin
 if position('''status'', new.status' in definition)=0 then
   if position('''response_kind'', case' in definition)=0 then raise exception 'Assignment response metadata not found'; end if;
   execute replace(definition,'''response_kind'', case','''status'', new.status, ''member'', v_user_name, ''response_kind'', case');
 end if;
end;
$migration$;

revoke all on function private.notification_variants(), private.classify_notification(text,jsonb),
 private.classify_notification_insert(), private.seed_notification_variants(uuid),
 private.seed_new_org_notification_variants() from public,anon,authenticated;

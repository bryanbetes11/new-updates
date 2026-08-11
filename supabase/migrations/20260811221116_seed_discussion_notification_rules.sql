insert into public.notification_rules (
  org_id, type, label, category, description, target_roles,
  enabled, required, in_app_enabled, push_enabled, priority, reminder_offsets
)
select
  o.id, rule.type, rule.label, rule.category, rule.description, rule.target_roles,
  true, false, true, true, rule.priority, '{}'::integer[]
from public.organizations o
cross join (
  values
    (
      'setlist_revision_comment'::text,
      'Revision discussion activity'::text,
      'setlists'::text,
      'The assigned Song Leader and Setlist Coordinators are told about revision comments and replies.'::text,
      array['Song Leader', 'Setlist Coordinator']::text[],
      'high'::text
    ),
    (
      'video_comment'::text,
      'Video discussion comment'::text,
      'communication'::text,
      'Active members are told when a new comment is added to a library video.'::text,
      array['Members']::text[],
      'normal'::text
    )
) as rule(type, label, category, description, target_roles, priority)
on conflict (org_id, type) do update set
  label = excluded.label,
  category = excluded.category,
  description = excluded.description,
  target_roles = excluded.target_roles,
  priority = excluded.priority;

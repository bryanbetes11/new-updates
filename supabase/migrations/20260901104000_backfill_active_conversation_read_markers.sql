-- Repair read markers for conversations that users demonstrably opened while
-- conversation_members updates were blocked by the broken tenant trigger.
update public.conversation_members cm
set last_read_at = greatest(
  coalesce(cm.last_read_at, '-infinity'::timestamptz),
  acv.last_seen_at
)
from public.active_conversation_views acv
where acv.conversation_id = cm.conversation_id
  and acv.user_id = cm.user_id
  and acv.last_seen_at > coalesce(cm.last_read_at, '-infinity'::timestamptz);

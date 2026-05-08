-- ============================================================================
-- Make push notification tags unique per notification row
-- ----------------------------------------------------------------------------
-- Purpose:
--   * prevent browser/mobile notification replacement caused by a shared tag
--   * preserve one visible lockscreen/banner event per inserted notification
-- ============================================================================

drop function if exists public.trigger_push_notification() cascade;

create or replace function public.trigger_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id bigint;
begin
  select net.http_post(
    url := 'https://uhwkrxihyqkagirdjhht.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'user_id', new.user_id::text,
      'title', new.title,
      'body', new.body,
      'data',
        coalesce(new.data, '{}'::jsonb) ||
        jsonb_build_object(
          'notification_id', new.id::text,
          'notification_type', new.type
        )
    )
  ) into v_request_id;

  return new;
exception
  when others then
    raise warning 'Push notification request failed: %', sqlerrm;
    return new;
end;
$$;

drop trigger if exists trg_send_push_notification on public.notifications;

create trigger trg_send_push_notification
  after insert on public.notifications
  for each row
  when (new.is_read = false)
  execute function public.trigger_push_notification();

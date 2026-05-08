-- ============================================================================
-- Schedule daily leadership member-action reminders
-- ----------------------------------------------------------------------------
-- Purpose:
--   * remind leadership about unresolved member follow-ups
--   * cover overdue proposals, attendance offenses, open discipline, and
--     pending leave approvals in one daily summary notification
-- ============================================================================

select cron.unschedule('check-leadership-member-actions-daily')
where exists (
  select 1
  from cron.job
  where jobname = 'check-leadership-member-actions-daily'
);

select
  cron.schedule(
    'check-leadership-member-actions-daily',
    '0 1 * * *',
    $$
    select
      net.http_post(
        url := 'https://uhwkrxihyqkagirdjhht.supabase.co/functions/v1/check-leadership-member-actions?cron_key=leadership-member-actions-cron-2026-05-04',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{}'::jsonb
      );
    $$
  );

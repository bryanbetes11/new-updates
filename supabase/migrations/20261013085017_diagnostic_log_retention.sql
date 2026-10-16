-- Preserve application data and all existing automatic job definitions.
-- The cleanup targets completed pg_cron diagnostic history only.
-- pg_cron runs these schedules in UTC: 03:10 and 03:15 Asia/Manila.
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';

SELECT cron.schedule(
  'servesync-cleanup-completed-cron-history',
  '10 19 * * *',
  $cleanup$
    SET LOCAL lock_timeout = '2s';
    SET LOCAL statement_timeout = '15s';
    DELETE FROM cron.job_run_details
    WHERE end_time < now() - interval '30 days'
      AND status IN ('succeeded', 'failed');
  $cleanup$
);

-- Regular VACUUM allows reads/writes. SKIP_LOCKED avoids waiting on a
-- busy table; TRUNCATE FALSE avoids the exclusive tail-truncation lock.
-- This maintains reusable free space after the separate one-time compaction.
SELECT cron.schedule(
  'servesync-vacuum-diagnostic-tables',
  '15 19 * * *',
  $vacuum$
    VACUUM (ANALYZE, SKIP_LOCKED, TRUNCATE FALSE)
      net._http_response, cron.job_run_details;
  $vacuum$
);

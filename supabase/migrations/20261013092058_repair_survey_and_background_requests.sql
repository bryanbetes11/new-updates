-- Repair reminder deduplication without changing its recipient-specific index.
-- Preserve complete inbox records and existing schedules/access controls.
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';

CREATE OR REPLACE FUNCTION private.check_survey_campaign_timing()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.survey_campaigns set status='live',updated_at=now() where status='scheduled' and starts_at<=now();
  insert into public.notifications(user_id,org_id,type,title,body,data,delivery_channels,dedupe_key)
  select p.user_id,c.org_id,'survey_access_expiring','Temporary access ends in one hour','Continue your reflection now or finish it when you return.',jsonb_build_object('url','/reflection','campaign_id',p.campaign_id),'{"in_app":true,"push":true}','survey-access-hour:'||p.id::text
  from public.survey_participations p join public.survey_campaigns c on c.id=p.campaign_id
  where c.status='live' and p.submitted_at is null and p.status='temporary_access_active' and p.temporary_access_until between now()+interval '45 minutes' and now()+interval '75 minutes'
  on conflict(user_id, dedupe_key) where dedupe_key is not null do nothing;
  insert into public.notifications(user_id,org_id,type,title,body,data,delivery_channels,dedupe_key)
  select p.user_id,c.org_id,'survey_access_expired','Temporary access has ended','Your saved reflection is ready when you return to ServeSync.',jsonb_build_object('url','/reflection','campaign_id',p.campaign_id),'{"in_app":true,"push":true}','survey-access-expired:'||p.id::text||':'||extract(epoch from p.temporary_access_until)::bigint::text
  from public.survey_participations p join public.survey_campaigns c on c.id=p.campaign_id
  where c.status='live' and p.submitted_at is null and p.status='temporary_access_active' and p.temporary_access_until<=now()
  on conflict(user_id, dedupe_key) where dedupe_key is not null do nothing;
  update public.survey_participations set status='access_expired' where status='temporary_access_active' and temporary_access_until<=now() and submitted_at is null;
end; $function$;

-- Old invalid setlist pushes are terminal; their inbox text and read state stay intact.
UPDATE public.notifications
SET push_status = 'failed'
WHERE push_status = 'dispatching'
  AND type = 'setlist_revision'
  AND created_at < timestamptz '2026-10-01 00:00:00+00'
  AND length(body) > 1000;

-- Attendance checks sometimes outlast pg_net's five-second default.
-- Preserve each job's schedule, action, authentication, and active state.
DO $repair$
DECLARE
  v_job record;
  v_command text;
BEGIN
  FOR v_job IN
    SELECT jobid, command FROM cron.job
    WHERE jobname IN (
      'check-attendance-timed-reminders',
      'check-attendance-mark-absent',
      'check-attendance-remind',
      'check-attendance-missed-evening',
      'check-attendance-missed-final'
    )
  LOOP
    IF v_job.command NOT LIKE '%timeout_milliseconds%' THEN
      v_command := replace(v_job.command,
        'body := ''{}''::jsonb',
        'body := ''{}''::jsonb, timeout_milliseconds := 15000');
      IF v_command = v_job.command THEN
        RAISE EXCEPTION 'Attendance job % did not match the expected request body', v_job.jobid;
      END IF;
      PERFORM cron.alter_job(v_job.jobid, command := v_command);
    END IF;
  END LOOP;
END;
$repair$;

-- Enable the Weekend Digest production schedule.
--
-- The Weekend Digest schema, edge-function handling (digestType: "weekend"),
-- send-window gate (isWeekendDigestSendWindow: Thursday 18:00 Jerusalem),
-- idempotency, and full test coverage all already shipped — this migration
-- was the one missing piece: a release-readiness sweep found the Weekend
-- Digest had no cron trigger in production at all, so it could never send to
-- a real user despite being fully built and tested. Mirrors the existing
-- Daily/Weekly schedule migrations exactly.
--
-- pg_cron ticks in UTC every 15 minutes; the Edge Function's DST-aware
-- Asia/Jerusalem gate permits real work only during the local Thursday
-- 18:00 window. No `force` flag is sent, so the scheduler cannot bypass
-- that gate.

do $$
declare
  v_job record;
  v_project_url constant text := 'https://ghzpzimcxvccbmjsttlf.supabase.co';
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron')
    or not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise exception 'pg_cron and pg_net must be installed';
  end if;

  if not exists (
    select 1 from vault.decrypted_secrets
    where name = 'digitel_sync_service_role'
      and nullif(decrypted_secret, '') is not null
  ) then
    raise exception 'Vault service-role secret is missing';
  end if;

  -- Re-running the migration still leaves exactly one scheduler path.
  -- Matched by jobname only (not by endpoint URL): the Daily and Weekly
  -- schedules hit the same /functions/v1/send-daily-digest endpoint with a
  -- different body, so a URL-substring match here would risk unscheduling
  -- them too.
  for v_job in
    select jobid from cron.job
    where jobname = 'send-weekend-digest-jerusalem-thu-1800'
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;

  perform cron.schedule(
    'send-weekend-digest-jerusalem-thu-1800',
    '*/15 * * * *',
    format($command$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            select decrypted_secret from vault.decrypted_secrets
            where name = 'digitel_sync_service_role'
          )
        ),
        body := '{"dryRun":false,"digestType":"weekend"}'::jsonb,
        timeout_milliseconds := 120000
      );
    $command$, v_project_url || '/functions/v1/send-daily-digest')
  );
end;
$$;

-- ROLLBACK / EMERGENCY DISABLE:
-- select cron.unschedule('send-weekend-digest-jerusalem-thu-1800');

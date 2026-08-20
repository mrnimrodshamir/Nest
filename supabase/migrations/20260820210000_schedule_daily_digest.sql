-- Enable the approved Daily Digest production schedule.
-- pg_cron ticks in UTC every 15 minutes; the Edge Function's DST-aware
-- Asia/Jerusalem gate permits real work only during the local 07:00 window.
-- No `force` flag is sent, so the scheduler cannot bypass that gate.

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

  -- Re-running the migration still leaves exactly one scheduler path. Match
  -- both the stable name and endpoint so an older differently-named review
  -- job cannot survive beside the production job.
  for v_job in
    select jobid from cron.job
    where jobname = 'send-daily-digest-jerusalem-0700'
       or command like '%/functions/v1/send-daily-digest%'
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;

  perform cron.schedule(
    'send-daily-digest-jerusalem-0700',
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
        body := '{"dryRun":false}'::jsonb,
        timeout_milliseconds := 120000
      );
    $command$, v_project_url || '/functions/v1/send-daily-digest')
  );
end;
$$;

-- ROLLBACK / EMERGENCY DISABLE:
-- select cron.unschedule('send-daily-digest-jerusalem-0700');

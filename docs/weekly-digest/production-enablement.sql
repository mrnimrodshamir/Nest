-- PREPARED ONLY. Do not run until the controlled Weekly push is physically
-- validated and production enablement receives a separate explicit GO.
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
    where name = 'digitel_sync_service_role' and nullif(decrypted_secret, '') is not null
  ) then
    raise exception 'Vault service-role secret is missing';
  end if;

  for v_job in
    select jobid from cron.job
    where jobname = 'send-weekly-digest-jerusalem-1900'
       or command like '%send-daily-digest%weekly%'
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;

  perform cron.schedule(
    'send-weekly-digest-jerusalem-1900',
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
        body := '{"dryRun":false,"digestType":"weekly"}'::jsonb,
        timeout_milliseconds := 120000
      );
    $command$, v_project_url || '/functions/v1/send-daily-digest')
  );
end;
$$;

-- ROLLBACK / EMERGENCY DISABLE:
-- select cron.unschedule('send-weekly-digest-jerusalem-1900');

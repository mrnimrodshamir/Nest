-- Enable the verified Cinematheque sync every 24 hours through pg_cron +
-- pg_net, mirroring sync-digitel-events' own migration exactly (same
-- vault secret reused — it is a service-role credential, not scoped to
-- one provider; apply_complete_provider_sync itself is what enforces
-- provider_registry.enabled per call, not the credential).
--
-- Tel Aviv Port is deliberately NOT scheduled here: its edge function
-- (sync-tel-aviv-port-events) is deployed and verified once via manual
-- controlled sync, but live-invoked from Supabase's own egress it gets a
-- persistent HTTP 403 from namal.co.il (confirmed not a User-Agent issue —
-- a browser-shaped UA was added and it still 403s), which the connector
-- correctly fails closed on (sourceComplete=false, zero destructive
-- writes, confirmed in provider_sync_runs). Scheduling it now would just
-- accumulate "partial" runs with no data — see the final report for the
-- recommendation to revisit this once the egress-block question is
-- resolved.

do $$
declare
  v_project_url text := 'https://ghzpzimcxvccbmjsttlf.supabase.co';
  v_job_id bigint;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron')
    or not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise exception 'pg_cron and pg_net must be installed';
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'digitel_sync_service_role') then
    raise exception 'Vault secret digitel_sync_service_role is missing';
  end if;

  select jobid into v_job_id from cron.job where jobname = 'sync-tel-aviv-cinematheque-events-every-24-hours';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;

  perform cron.schedule(
    'sync-tel-aviv-cinematheque-events-every-24-hours',
    '30 4 * * *',
    format($command$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'digitel_sync_service_role')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000
      );
    $command$, v_project_url || '/functions/v1/sync-tel-aviv-cinematheque-events')
  );
end;
$$;

-- ROLLBACK (review and run manually only):
-- select cron.unschedule('sync-tel-aviv-cinematheque-events-every-24-hours');

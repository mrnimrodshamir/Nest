-- Enable the verified Beit Ariela sync every 24 hours through pg_cron +
-- pg_net, mirroring sync-digitel-events / sync-tel-aviv-cinematheque-events'
-- own migrations exactly (same reused vault secret — a service-role
-- credential, not scoped to one provider).
--
-- 24h chosen over 12h: no evidence of intraday update frequency for a
-- library events calendar (fresh dry-run and the live controlled sync
-- both showed the same 5 relevant occurrences, stable), and the brief
-- says choose the slower cadence absent evidence faster polling adds
-- value. Matches Cinematheque's own cadence for the same reason.

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

  select jobid into v_job_id from cron.job where jobname = 'sync-beit-ariela-events-every-24-hours';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;

  perform cron.schedule(
    'sync-beit-ariela-events-every-24-hours',
    '0 5 * * *',
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
    $command$, v_project_url || '/functions/v1/sync-beit-ariela-events')
  );
end;
$$;

-- ROLLBACK (review and run manually only):
-- select cron.unschedule('sync-beit-ariela-events-every-24-hours');

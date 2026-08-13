-- Enable the tested DigiTel sync every six hours through pg_cron + pg_net.
-- The service-role credential remains in Vault and is never embedded in this
-- migration, source control, cron.job output, or the Edge Function URL.

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

  select jobid into v_job_id from cron.job where jobname = 'sync-digitel-events-every-6-hours';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;

  perform cron.schedule(
    'sync-digitel-events-every-6-hours',
    '17 */6 * * *',
    format($command$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'digitel_sync_service_role')
        ),
        body := '{"dryRun":false}'::jsonb,
        timeout_milliseconds := 120000
      );
    $command$, v_project_url || '/functions/v1/sync-digitel-events')
  );
end;
$$;

-- ROLLBACK (review and run manually only):
-- select cron.unschedule('sync-digitel-events-every-6-hours');
-- select vault.delete_secret(id) from vault.secrets where name = 'digitel_sync_service_role';

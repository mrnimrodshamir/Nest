-- The public Smarticket calendar changed across the week and the 7-day
-- connector horizon is short. Poll every 12 hours: fresher than daily without
-- the load of the six-hour high-churn DigiTel feed. Exactly one job is kept.
do $$
declare
  v_project_url text := 'https://ghzpzimcxvccbmjsttlf.supabase.co';
  v_job_id bigint;
begin
  if not exists (select 1 from pg_extension where extname='pg_cron')
    or not exists (select 1 from pg_extension where extname='pg_net') then
    raise exception 'pg_cron and pg_net must be installed';
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name='digitel_sync_service_role') then
    raise exception 'Vault service-role sync secret is missing';
  end if;
  if not exists (
    select 1 from public.city_registry where city_id='ramat_gan' and enabled
  ) then raise exception 'Ramat Gan must be enabled before scheduling'; end if;

  select jobid into v_job_id from cron.job
  where jobname='sync-beit-emanuel-events-every-12-hours';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;

  perform cron.schedule(
    'sync-beit-emanuel-events-every-12-hours',
    '43 */12 * * *',
    format($command$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='digitel_sync_service_role')
        ),
        body := '{"dryRun":false}'::jsonb,
        timeout_milliseconds := 120000
      );
    $command$, v_project_url || '/functions/v1/sync-beit-emanuel-events')
  );

  update public.provider_registry
  set schedule_cron='43 */12 * * *', updated_at=now()
  where key='ramat_gan_beit_emanuel';
end $$;

-- ROLLBACK: select cron.unschedule('sync-beit-emanuel-events-every-12-hours');
-- update public.provider_registry set schedule_cron=null where key='ramat_gan_beit_emanuel';

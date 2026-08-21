-- Supervised autonomous NestUp operator schedules.
-- Both jobs call the same function and may perform Green diagnostics plus
-- create pending Yellow approval requests. They have no production-content,
-- provider-enablement, release, or owner-decision path.

create or replace function public.operator_health_snapshot()
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'providerCronMatches', coalesce((
      select jsonb_object_agg(p.key, (
        select count(*) from cron.job j
        where j.active and (
          j.schedule = p.schedule_cron
          or j.jobname ilike '%' || replace(p.key, '_', '-') || '%'
          or j.command ilike '%' || p.key || '%'
        )
      )) from public.provider_registry p where p.enabled
    ), '{}'::jsonb),
    'operatorDailyJobs', (select count(*) from cron.job where active and jobname='nestup-operator-daily'),
    'operatorWeeklyJobs', (select count(*) from cron.job where active and jobname='nestup-operator-weekly-source-hunt'),
    'publicTablesWithoutRls', (
      select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r' and c.relname<>'spatial_ref_sys' and not c.relrowsecurity
    )
  );
$$;

revoke all on function public.operator_health_snapshot() from public, anon, authenticated;
grant execute on function public.operator_health_snapshot() to service_role;

do $$
declare
  v_job record;
  v_project_url constant text := 'https://ghzpzimcxvccbmjsttlf.supabase.co';
begin
  if not exists(select 1 from pg_extension where extname='pg_cron')
     or not exists(select 1 from pg_extension where extname='pg_net') then
    raise exception 'pg_cron and pg_net must be installed';
  end if;
  if not exists(select 1 from vault.decrypted_secrets where name='digitel_sync_service_role' and nullif(decrypted_secret,'') is not null) then
    raise exception 'Vault service-role secret is missing';
  end if;

  for v_job in select jobid from cron.job
    where jobname in ('nestup-operator-daily','nestup-operator-weekly-source-hunt')
       or command like '%/functions/v1/run-nestup-operator%'
  loop perform cron.unschedule(v_job.jobid); end loop;

  perform cron.schedule(
    'nestup-operator-daily',
    '15 3 * * *',
    format($command$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='digitel_sync_service_role')),
        body := '{"mode":"daily","scheduled":true}'::jsonb,
        timeout_milliseconds := 120000
      );
    $command$, v_project_url || '/functions/v1/run-nestup-operator')
  );

  perform cron.schedule(
    'nestup-operator-weekly-source-hunt',
    '30 3 * * 1',
    format($command$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='digitel_sync_service_role')),
        body := '{"mode":"source_hunt","scheduled":true}'::jsonb,
        timeout_milliseconds := 120000
      );
    $command$, v_project_url || '/functions/v1/run-nestup-operator')
  );
end;
$$;

-- ROLLBACK / EMERGENCY DISABLE:
-- select cron.unschedule('nestup-operator-daily');
-- select cron.unschedule('nestup-operator-weekly-source-hunt');
-- drop function if exists public.operator_health_snapshot();

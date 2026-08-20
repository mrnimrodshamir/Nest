# Daily Digest production enablement

The function is designed for a 15-minute UTC cron tick and performs the real
`07:00 Asia/Jerusalem` decision inside the Edge Function with `Intl` timezone
data. This avoids hard-coding Israel's changing UTC offset.

The production schedule is tracked by migration
`20260820210000_schedule_daily_digest.sql`. The SQL below documents the same
single-job design and emergency rollback procedure.

```sql
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
    raise exception 'Vault service-role secret is missing';
  end if;

  select jobid into v_job_id from cron.job where jobname = 'send-daily-digest-jerusalem-0700';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;

  perform cron.schedule(
    'send-daily-digest-jerusalem-0700',
    '*/15 * * * *',
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
    $command$, v_project_url || '/functions/v1/send-daily-digest')
  );
end;
$$;
```

Rollback/disable:

```sql
select cron.unschedule('send-daily-digest-jerusalem-0700');
```

The function must be deployed with JWT verification enabled. `force:true` is
reserved for an explicitly approved manual dry run or controlled test push;
the cron body never bypasses the Jerusalem send-window gate.

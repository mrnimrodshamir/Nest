-- Cached provider Event translations. Original public.events.title/description
-- remain authoritative and are never overwritten by this feature.

create table if not exists public.event_content_translations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  locale text not null check (locale in ('en', 'he', 'fr', 'ru')),
  source_language text not null check (source_language in ('en', 'he', 'fr', 'ru', 'mixed', 'unknown')),
  source_fingerprint text not null,
  translated_title text not null check (length(trim(translated_title)) > 0),
  translated_description text,
  translation_provider text not null,
  translation_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, locale)
);

create index if not exists event_content_translations_lookup_idx
  on public.event_content_translations(event_id, locale, source_fingerprint);

alter table public.event_content_translations enable row level security;

drop policy if exists event_translations_read_published on public.event_content_translations;
create policy event_translations_read_published
on public.event_content_translations for select to authenticated
using (exists (
  select 1 from public.events event
  where event.id = event_content_translations.event_id
    and event.publication_status = 'published'
    and event.verification_status = 'verified'
));

revoke insert, update, delete on public.event_content_translations from anon, authenticated;
grant select on public.event_content_translations to authenticated;
grant all on public.event_content_translations to service_role;

create table if not exists public.event_translation_jobs (
  event_id uuid primary key references public.events(id) on delete cascade,
  source_updated_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'retry', 'complete')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.event_translation_jobs enable row level security;
revoke all on public.event_translation_jobs from public, anon, authenticated;
grant all on public.event_translation_jobs to service_role;

-- Idempotently discovers new/changed provider content. It never calls an
-- external service and can safely fail independently of DigiTel ingestion.
create or replace function public.enqueue_event_translation_jobs(p_provider text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.event_translation_jobs (
    event_id, source_updated_at, status, attempt_count, next_attempt_at,
    locked_at, last_error_code, updated_at
  )
  select event.id, event.updated_at, 'pending', 0, now(), null, null, now()
  from public.events event
  where event.publication_status = 'published'
    and event.verification_status = 'verified'
    and length(trim(event.title)) > 0
    and (p_provider is null or event.provider = p_provider)
  on conflict (event_id) do update set
    source_updated_at = excluded.source_updated_at,
    status = 'pending', attempt_count = 0, next_attempt_at = now(),
    locked_at = null, last_error_code = null, updated_at = now()
  where event_translation_jobs.source_updated_at is distinct from excluded.source_updated_at;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.enqueue_event_translation_jobs(text) from public, anon, authenticated;
grant execute on function public.enqueue_event_translation_jobs(text) to service_role;

-- A short lease plus SKIP LOCKED prevents duplicate provider calls across warm
-- Edge Function instances. Abandoned work becomes claimable after 10 minutes.
create or replace function public.claim_event_translation_jobs(p_limit integer default 20)
returns table (
  event_id uuid,
  title text,
  description text,
  source_updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_limit < 1 or p_limit > 50 then
    raise exception 'Translation batch limit must be between 1 and 50';
  end if;
  return query
  with claimable as (
    select job.event_id
    from public.event_translation_jobs job
    where (
      job.status in ('pending', 'retry') and job.next_attempt_at <= now()
    ) or (
      job.status = 'processing' and job.locked_at < now() - interval '10 minutes'
    )
    order by job.next_attempt_at, job.event_id
    for update skip locked
    limit p_limit
  ), claimed as (
    update public.event_translation_jobs job set
      status = 'processing', locked_at = now(),
      attempt_count = job.attempt_count + 1, updated_at = now()
    from claimable
    where job.event_id = claimable.event_id
    returning job.event_id, job.source_updated_at
  )
  select event.id, event.title, event.description, claimed.source_updated_at
  from claimed join public.events event on event.id = claimed.event_id;
end;
$$;

revoke all on function public.claim_event_translation_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_event_translation_jobs(integer) to service_role;

-- Seed only the internal queue. No provider call and no Event content mutation
-- occurs during migration application.
select public.enqueue_event_translation_jobs(null);

-- Reuse the existing Vault-held service credential when automation is already
-- configured. Absence of cron/net/Vault leaves the migration successful and
-- the worker manually invokable after deployment.
do $$
declare
  v_job_id bigint;
  v_project_url text := 'https://ghzpzimcxvccbmjsttlf.supabase.co';
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
    and exists (select 1 from pg_extension where extname = 'pg_net')
    and exists (select 1 from vault.decrypted_secrets where name = 'digitel_sync_service_role') then
    select jobid into v_job_id from cron.job where jobname = 'translate-event-content-every-10-minutes';
    if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
    perform cron.schedule(
      'translate-event-content-every-10-minutes',
      '3,13,23,33,43,53 * * * *',
      format($command$
        select net.http_post(
          url := %L,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'digitel_sync_service_role')
          ),
          body := '{"dryRun":false,"limit":20}'::jsonb,
          timeout_milliseconds := 120000
        );
      $command$, v_project_url || '/functions/v1/translate-event-content')
    );
  end if;
end;
$$;

-- ROLLBACK (review and run manually only):
-- select cron.unschedule('translate-event-content-every-10-minutes');
-- drop function if exists public.claim_event_translation_jobs(integer);
-- drop function if exists public.enqueue_event_translation_jobs(text);
-- drop table if exists public.event_translation_jobs;
-- drop table if exists public.event_content_translations;

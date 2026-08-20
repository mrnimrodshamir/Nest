-- Daily Digest retention feature: schema only. Does NOT schedule the cron
-- job — the send-daily-digest function is deployed and dry-run-tested
-- first; scheduling it is a separate, explicitly-approved follow-up
-- migration (see the DigiTel/Cinematheque/Beit Ariela precedent in
-- 20260814150000_schedule_digitel_sync.sql for the pattern to reuse).
--
-- SAFE TO RUN AGAINST PRODUCTION: every statement is `if not exists` /
-- `add column if not exists`, so re-running this is a no-op once applied.

-- `profiles.locale` did not previously exist anywhere server-side — the
-- chosen app language lived only in client AsyncStorage. A server-side cron
-- job has no client to ask, so the app must start syncing this column
-- whenever the user changes (or first resolves) their locale. Nullable: a
-- null value means "unknown," and every consumer (buildDigestPushCopy)
-- already falls back to English for a null/unrecognized locale rather than
-- guessing or skipping the user.
alter table public.profiles add column if not exists locale text;
alter table public.profiles add column if not exists locale_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_locale_supported'
  ) then
    alter table public.profiles add constraint profiles_locale_supported
      check (locale is null or locale in ('en', 'he', 'fr', 'ru', 'ar', 'es'));
  end if;
end $$;

comment on column public.profiles.locale is
  'The user''s explicitly chosen in-app language (en/he/fr/ru/ar/es), synced from the client I18nProvider. Null means unknown/never set — treat as English, never guess.';

-- `notification_preferences` already exists as jsonb (predates tracked
-- migrations; see push_tokens below for the same situation) — this is a
-- documentation-only backfill, not a schema change, since jsonb has no
-- fixed column list to alter. New installs/rows get the flag explicitly so
-- `daily_digest` is never silently absent (which the eligibility query
-- would otherwise treat as "false" via ->>'daily_digest' being null, which
-- is the correct fail-closed behavior — but making it explicit here means a
-- freshly onboarded user's preferences object always has the same shape).
update public.profiles
set notification_preferences = coalesce(notification_preferences, '{}'::jsonb) || jsonb_build_object('daily_digest', false)
where notification_preferences is null
   or not (notification_preferences ? 'daily_digest');

comment on column public.profiles.notification_preferences is
  'jsonb: {activity_changes, chat_messages, reminders, daily_digest}. Every category is opt-in; a missing/false key must never be treated as "on".';

-- The existing public active-occurrence view is the single lifecycle gate
-- used by Discovery. Append only the two non-sensitive event identity/source
-- fields required by digest dedupe and attribution; keep every existing
-- column and WHERE predicate unchanged for old clients.
create or replace view public.active_event_occurrences as
select
  o.id as occurrence_id,
  o.event_id,
  o.provider_occurrence_id,
  o.occurrence_fingerprint,
  o.starts_at,
  o.ends_at,
  o.original_starts_at,
  o.occurrence_status,
  o.cancellation_reason as occurrence_cancellation_reason,
  o.source_updated_at as occurrence_source_updated_at,
  o.provider_metadata as occurrence_provider_metadata,
  e.title,
  e.description,
  e.category,
  e.image_url,
  e.age_min_months,
  e.age_max_months,
  e.price_note,
  e.registration_required,
  e.registration_url,
  e.verification_status,
  e.publication_status,
  e.event_status,
  e.cancellation_reason,
  e.provider,
  e.provider_event_id,
  e.provider_transport_id,
  e.source_group_id,
  e.source_name,
  e.source_url,
  e.source_published_at,
  e.source_updated_at,
  e.provider_metadata,
  e.is_recurring,
  e.recurrence_rule,
  e.recurrence_timezone,
  e.recurrence_series_id,
  e.place_id,
  e.location_name,
  e.formatted_address,
  e.latitude,
  e.longitude,
  e.created_at,
  e.updated_at,
  e.source_type,
  e.canonical_event_id
from public.event_occurrences o
join public.events e on e.id = o.event_id
where e.publication_status = 'published'
  and e.verification_status = 'verified'
  and e.is_visible
  and coalesce(o.ends_at, o.starts_at) >= now()
  and o.occurrence_status is distinct from 'cancelled'
  and e.event_status is distinct from 'cancelled'
  and o.archived_at is null;

grant select on public.active_event_occurrences to authenticated;

-- `push_tokens` likewise predates tracked migrations. Formalizing shape only
-- (if not exists), not touching existing rows.
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  created_at timestamptz not null default now(),
  unique (user_id, token)
);

alter table public.push_tokens enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'push_tokens' and policyname = 'push_tokens_own_rows'
  ) then
    create policy push_tokens_own_rows on public.push_tokens
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

revoke all on public.push_tokens from anon;

-- One row per (digest_type, date, city) actually generated — NOT a copy of
-- Event content, only occurrence IDs, per the "no parallel Events database"
-- constraint. Exists for analytics/reproducibility: "what did we send on
-- 2026-08-20" should be answerable without re-running selection logic.
create table if not exists public.daily_digest_instances (
  id uuid primary key default gen_random_uuid(),
  digest_type text not null default 'daily',
  digest_date date not null,
  city text not null,
  selected_occurrence_ids text[] not null,
  selection_version integer not null default 1,
  created_at timestamptz not null default now(),
  unique (digest_type, digest_date, city)
);

create index if not exists daily_digest_instances_date_idx on public.daily_digest_instances(digest_date, city);
create unique index if not exists daily_digest_instances_identity_idx
  on public.daily_digest_instances(digest_type, digest_date, city);

alter table public.daily_digest_instances enable row level security;
revoke all on public.daily_digest_instances from anon, authenticated;

-- The idempotency guarantee itself. `send_key` = user_id:digest_type:local_date
-- (see supabase/functions/_shared/dailyDigest/idempotency.ts) — its UNIQUE
-- constraint, not application logic, is what makes a cron retry or a
-- concurrent invocation unable to double-send the same user the same digest.
create table if not exists public.daily_digest_sends (
  id uuid primary key default gen_random_uuid(),
  send_key text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  digest_id uuid not null references public.daily_digest_instances(id) on delete cascade,
  digest_type text not null default 'daily',
  digest_date date not null,
  status text not null default 'claimed' check (status in ('claimed', 'sent', 'failed')),
  failure_code text,
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (user_id, digest_type, digest_date)
);

-- Also reconcile an earlier local/review application of this migration.
alter table public.daily_digest_sends add column if not exists digest_type text not null default 'daily';
alter table public.daily_digest_sends add column if not exists status text not null default 'claimed';
alter table public.daily_digest_sends add column if not exists failure_code text;
alter table public.daily_digest_sends add column if not exists claimed_at timestamptz not null default now();
alter table public.daily_digest_sends alter column sent_at drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'daily_digest_sends_status_check') then
    alter table public.daily_digest_sends add constraint daily_digest_sends_status_check
      check (status in ('claimed', 'sent', 'failed'));
  end if;
end $$;

create index if not exists daily_digest_sends_user_date_idx on public.daily_digest_sends(user_id, digest_date);
create unique index if not exists daily_digest_sends_logical_identity_idx
  on public.daily_digest_sends(user_id, digest_type, digest_date);

alter table public.daily_digest_sends enable row level security;
revoke all on public.daily_digest_sends from anon, authenticated;

-- ROLLBACK (review and run manually only):
-- drop table if exists public.daily_digest_sends;
-- drop table if exists public.daily_digest_instances;
-- alter table public.profiles drop column if exists locale;
-- alter table public.profiles drop column if exists locale_updated_at;
-- Recreate active_event_occurrences without source_type/canonical_event_id
-- only if rollback must restore its exact earlier column contract.
-- (push_tokens is left in place even on rollback — it predates this
-- migration and other features may already depend on it existing.)

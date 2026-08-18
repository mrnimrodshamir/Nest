-- Reconciles repository history with two objects that exist in production but
-- were never committed: public.provider_sync_runs (created ~2026-08-12 as
-- "digitel_sync_observability_foundation") and the view
-- public.active_event_occurrences (created the same day as
-- "active_event_occurrences_view"). Both are read directly from the live
-- database's information_schema/pg_get_viewdef here, not re-derived from
-- memory, so this migration describes what is actually running.
--
-- SAFE TO RUN AGAINST PRODUCTION: every statement is `if not exists` /
-- `create or replace`, so applying this where the objects already exist is a
-- no-op for their shape. It does NOT drop, rename or re-migrate any existing
-- row. The one substantive change is tightening default grants on the view
-- (see below) — that is a permission fix, not a data or shape change.
--
-- WHY THIS APPROACH RATHER THAN "blindly reapply": the two source migrations
-- that created these objects were never found in supabase/migrations/, so
-- there is nothing to "reapply" — there was never a file. Re-running the
-- CREATE statements as informally reconstructed from memory would risk
-- committing a definition that has since drifted from what production
-- actually runs. Instead this migration was written FROM the live schema
-- (information_schema.columns, pg_get_viewdef, pg_indexes, pg_policies,
-- pg_constraint), so the repository now matches reality rather than a guess.

create table if not exists public.provider_sync_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'success', 'partial', 'failed')),
  source_complete boolean not null default false,
  source_records_fetched integer not null default 0,
  normalized integer not null default 0,
  inserted integer not null default 0,
  updated integer not null default 0,
  unchanged integer not null default 0,
  excluded integer not null default 0,
  duplicates integer not null default 0,
  stale_unpublished integer not null default 0,
  cleaned integer not null default 0,
  archived integer not null default 0,
  errors integer not null default 0,
  error_summary text,
  created_at timestamptz not null default now()
);

create index if not exists provider_sync_runs_provider_started_idx
  on public.provider_sync_runs(provider, started_at desc);

alter table public.provider_sync_runs enable row level security;

-- Matches production: only service_role reads/writes this table today. No
-- policy exists for authenticated/anon in the live database, so none is
-- added here — RLS with zero policies denies all non-service-role access,
-- which is the current (and correct) behavior for an internal ops table.
revoke all on public.provider_sync_runs from anon, authenticated;
grant select, insert, update on public.provider_sync_runs to service_role;

comment on table public.provider_sync_runs is
  'Observability for every provider sync run: source completeness and per-run counts. Provider-neutral by design — provider is free text, not a DigiTel-specific enum.';

-- The view, exactly as it runs in production (via pg_get_viewdef).
create or replace view public.active_event_occurrences as
 SELECT o.id AS occurrence_id,
    o.event_id,
    o.provider_occurrence_id,
    o.occurrence_fingerprint,
    o.starts_at,
    o.ends_at,
    o.original_starts_at,
    o.occurrence_status,
    o.cancellation_reason AS occurrence_cancellation_reason,
    o.source_updated_at AS occurrence_source_updated_at,
    o.provider_metadata AS occurrence_provider_metadata,
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
    e.updated_at
   FROM event_occurrences o
     JOIN events e ON e.id = o.event_id
  WHERE e.publication_status = 'published'::text
    AND e.verification_status = 'verified'::text
    AND e.is_visible
    AND COALESCE(o.ends_at, o.starts_at) >= now()
    AND o.occurrence_status IS DISTINCT FROM 'cancelled'::text
    AND e.event_status IS DISTINCT FROM 'cancelled'::text
    AND o.archived_at IS NULL;

comment on view public.active_event_occurrences is
  'Discovery-facing horizon of published, verified, non-cancelled, non-archived occurrences that have not yet ended. The 7-day upcoming window is applied by the client/query layer on top of this, not baked in here.';

-- GRANT FIX: information_schema showed anon and authenticated holding
-- INSERT/UPDATE/DELETE/TRUNCATE on this view via Postgres' default-owner
-- grants. A two-table join view has no automatic updatable-view machinery, so
-- those grants were inert in practice (any write would fail), but leaving
-- them listed is still wrong: every other public content view/table in this
-- schema explicitly revokes from anon/authenticated and grants SELECT only to
-- authenticated (see 0009_events_domain.sql). This view was the one place
-- that pattern was never applied. Fixing it here is a permission tightening,
-- not a behavior change — nothing was actually writable through it before.
revoke all on public.active_event_occurrences from anon, authenticated;
grant select on public.active_event_occurrences to authenticated;

-- ROLLBACK (review and run manually only):
-- drop view if exists public.active_event_occurrences;
-- drop table if exists public.provider_sync_runs;
-- (Rolling back the view also removes the grant fix; there is nothing else
-- to undo since every other statement here is idempotent against the
-- pre-existing production shape.)

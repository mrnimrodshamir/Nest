-- Provider registry: the source of truth for which providers exist, what kind
-- of source they are, and whether their sync is currently allowed to run.
--
-- events.provider (a plain text column, unique with provider_event_id) already
-- identifies WHICH provider a row came from. This table is what makes that
-- identifier mean something operationally: is it enabled, what connector
-- fetches it, what schedule does it run on, when did it last succeed. Without
-- it, "add a provider" means grepping the codebase for every place the string
-- 'tel_aviv_digitel' appears — which is precisely the scattered-logic outcome
-- this table exists to prevent.
--
-- events.provider is intentionally left as a soft reference (no FK) to
-- provider_registry.key: disabling or retiring a provider must never cascade
-- into its historical events, and a provider can exist here before its first
-- sync has written anything.

create table if not exists public.provider_registry (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  name text not null check (length(trim(name)) > 0),
  source_type text not null check (source_type in ('municipal', 'external_organizer')),
  base_url text not null check (base_url ~ '^https://'),
  -- The dispatch tag the generic sync core uses to pick a connector module.
  -- New values are added as new connectors ship; nothing about the sync core
  -- itself branches on this string.
  connector_type text not null check (connector_type in ('arcgis', 'html_extraction', 'manual')),
  enabled boolean not null default false,
  -- Null until a human has decided a schedule for this provider. A row can
  -- exist, be dry-run and reviewed, and still have no schedule.
  schedule_cron text,
  trust_level text not null default 'standard' check (trust_level in ('standard', 'trusted', 'experimental')),
  default_city text not null default 'Tel Aviv-Yafo',
  last_sync_at timestamptz,
  last_sync_status text check (last_sync_status is null or last_sync_status in ('success', 'partial', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.provider_registry enable row level security;

create policy "Authenticated users read the provider registry" on public.provider_registry
  for select to authenticated
  using (true);

revoke insert, update, delete on public.provider_registry from anon, authenticated;
grant select on public.provider_registry to authenticated;
grant select, insert, update on public.provider_registry to service_role;

comment on table public.provider_registry is
  'One row per event/activity source (municipal or external organizer). Governs which connector runs, on what schedule, and whether it is currently enabled — never hardcoded per-provider in the sync core.';
comment on column public.provider_registry.key is
  'Matches events.provider by convention (soft reference, no FK — disabling a provider must never cascade into its historical events).';
comment on column public.provider_registry.connector_type is
  'Dispatch tag only. The generic sync core does not branch on provider identity, only on this field, to pick a connector module.';

-- Seed the one provider already live in production, exactly as it already
-- behaves: enabled, on its existing 6-hour schedule. This is a description of
-- current reality, not a behavior change — sync-digitel-events and its cron
-- job are untouched by this migration.
insert into public.provider_registry
  (key, name, source_type, base_url, connector_type, enabled, schedule_cron, trust_level, last_sync_status)
values
  ('tel_aviv_digitel', 'Tel Aviv Municipality (DigiTel)', 'municipal',
   'https://www.tel-aviv.gov.il', 'arcgis', true, '17 */6 * * *', 'trusted', 'success')
on conflict (key) do nothing;

-- The new connector this migration exists to support. Disabled: no schedule
-- runs until a human reviews the dry run and explicitly turns it on.
insert into public.provider_registry
  (key, name, source_type, base_url, connector_type, enabled, schedule_cron, trust_level)
values
  ('beit_ariela_libraries', 'Beit Ariela — Tel Aviv Public Libraries', 'municipal',
   'https://ariela.today', 'html_extraction', false, null, 'standard')
on conflict (key) do nothing;

-- ROLLBACK (review and run manually only):
-- drop table if exists public.provider_registry;
-- (Additive only; no existing table, column or row is touched.)

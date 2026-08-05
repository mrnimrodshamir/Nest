-- Sprint 9: timestamp-compatible controlled Events activation.
-- Intentionally excludes the licensed image pipeline and all source images.
create table public.event_providers (
  id text primary key check (id ~ '^[a-z0-9_]+$'),
  display_name text not null check (length(trim(display_name)) > 0),
  source_base_url text not null check (source_base_url ~ '^https://'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.event_providers (id, display_name, source_base_url)
values ('tel_aviv_digitel', 'Tel Aviv DigiTel', 'https://www.tel-aviv.gov.il/')
on conflict (id) do nothing;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text,
  category text not null check (category in ('story_time','workshop','performance','festival','museum','library','park','sports','community','animals','other')),
  image_url text check (image_url is null),
  age_min_months integer check (age_min_months is null or age_min_months >= 0),
  age_max_months integer check (age_max_months is null or age_max_months >= 0),
  price_note text,
  registration_required boolean,
  registration_url text,
  verification_status text not null check (verification_status in ('staged','needs_review','verified','rejected')),
  publication_status text not null check (publication_status in ('staged','published','archived')),
  is_visible boolean not null default false,
  event_status text not null default 'scheduled' check (event_status in ('scheduled','cancelled','postponed')),
  cancellation_reason text,
  provider text not null references public.event_providers(id) on delete restrict,
  provider_event_id text not null check (length(trim(provider_event_id)) > 0),
  provider_transport_id text not null check (length(trim(provider_transport_id)) > 0),
  source_group_id text,
  source_name text not null,
  source_url text not null check (source_url ~ '^https://'),
  source_published_at timestamptz,
  source_updated_at timestamptz,
  provider_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(provider_metadata) = 'object'),
  is_recurring boolean not null default false,
  recurrence_rule text,
  recurrence_timezone text not null default 'Asia/Jerusalem',
  recurrence_series_id text,
  place_id uuid references public.places(id) on delete set null,
  location_name text not null,
  formatted_address text,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  location geography(Point, 4326) generated always as (st_setsrid(st_makepoint(longitude, latitude), 4326)::geography) stored,
  deduplication_key text not null,
  import_batch_id text not null,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_event_id),
  unique (provider, provider_transport_id),
  check (age_min_months is null or age_max_months is null or age_min_months <= age_max_months),
  check (recurrence_rule is null or is_recurring),
  check (event_status = 'cancelled' or cancellation_reason is null),
  check (not is_visible or (verification_status = 'verified' and publication_status = 'published'))
);

create table public.event_occurrences (
  id text primary key check (id ~ '^event-occ-v1-[0-9a-f]{16}$'),
  event_id uuid not null references public.events(id) on delete cascade,
  provider_occurrence_id text not null,
  occurrence_fingerprint text not null check (length(trim(occurrence_fingerprint)) > 0),
  starts_at timestamptz not null,
  ends_at timestamptz,
  original_starts_at timestamptz,
  occurrence_status text not null default 'scheduled' check (occurrence_status in ('scheduled','cancelled','postponed')),
  cancellation_reason text,
  source_updated_at timestamptz,
  provider_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(provider_metadata) = 'object'),
  import_batch_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, starts_at),
  unique (event_id, provider_occurrence_id),
  unique (occurrence_fingerprint),
  check (ends_at is null or ends_at >= starts_at),
  check (occurrence_status = 'cancelled' or cancellation_reason is null)
);

create index events_visibility_idx on public.events(is_visible, publication_status, verification_status);
create index events_location_idx on public.events using gist(location);
create index events_place_idx on public.events(place_id) where place_id is not null;
create index events_batch_idx on public.events(import_batch_id);
create index event_occurrences_time_idx on public.event_occurrences(starts_at, ends_at);
create index event_occurrences_batch_idx on public.event_occurrences(import_batch_id);

alter table public.event_providers enable row level security;
alter table public.events enable row level security;
alter table public.event_occurrences enable row level security;

create policy "Authenticated users read verified visible events" on public.events
  for select to authenticated
  using (is_visible and publication_status = 'published' and verification_status = 'verified');

create policy "Authenticated users read verified visible occurrences" on public.event_occurrences
  for select to authenticated
  using (exists (
    select 1 from public.events event
    where event.id = event_id and event.is_visible
      and event.publication_status = 'published' and event.verification_status = 'verified'
  ));

revoke all on public.event_providers, public.events, public.event_occurrences from anon, authenticated;
grant select on public.events, public.event_occurrences to authenticated;

comment on table public.events is 'Verified curated events, separate from user-created activities. Source images are not published.';
comment on column public.events.provider_event_id is 'Deterministic normalized occurrence fingerprint; never DigiTel NbrId alone.';
comment on column public.events.provider_transport_id is 'DigiTel OBJECTID used only as source transport identity.';
comment on column public.events.source_group_id is 'DigiTel NbrId retained as non-unique source grouping metadata.';
comment on column public.events.image_url is 'Reserved for a later licensed-image activation; Sprint 9 requires NULL.';

-- ROLLBACK (manual, destructive to Sprint 9 Events only):
-- drop table if exists public.event_occurrences;
-- drop table if exists public.events;
-- drop table if exists public.event_providers;

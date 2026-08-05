-- Sprint 6 Events domain. Additive and local-only until separately approved.
-- Events are independent from user-created activities and curated places.
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text,
  category text check (category is null or category in (
    'story_time','workshop','performance','festival','museum','library','park',
    'sports','community','animals','other'
  )),
  image_url text,
  age_min_months integer check (age_min_months is null or age_min_months >= 0),
  age_max_months integer check (age_max_months is null or age_max_months >= 0),
  price_note text,
  registration_required boolean,
  registration_url text,
  verification_status text not null default 'staged'
    check (verification_status in ('staged','needs_review','verified','rejected')),
  publication_status text not null default 'staged'
    check (publication_status in ('staged','published','archived')),
  event_status text not null default 'scheduled'
    check (event_status in ('scheduled','cancelled','postponed')),
  cancellation_reason text,
  provider text not null check (length(trim(provider)) > 0),
  provider_event_id text not null check (length(trim(provider_event_id)) > 0),
  provider_transport_id text,
  source_group_id text,
  source_name text,
  source_url text,
  source_published_at timestamptz,
  source_updated_at timestamptz,
  provider_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(provider_metadata) = 'object'),
  is_recurring boolean not null default false,
  recurrence_rule text,
  recurrence_timezone text not null default 'Asia/Jerusalem',
  recurrence_series_id text,
  place_id uuid references public.places(id) on delete set null,
  location_name text,
  formatted_address text,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  deduplication_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_event_id),
  check (age_min_months is null or age_max_months is null or age_min_months <= age_max_months),
  check (recurrence_rule is null or is_recurring),
  check (event_status = 'cancelled' or cancellation_reason is null)
);

create table if not exists public.event_occurrences (
  id text primary key check (id ~ '^event-occ-v1-[0-9a-f]{16}$'),
  event_id uuid not null references public.events(id) on delete cascade,
  provider_occurrence_id text,
  occurrence_fingerprint text not null check (length(trim(occurrence_fingerprint)) > 0),
  starts_at timestamptz not null,
  ends_at timestamptz,
  original_starts_at timestamptz,
  occurrence_status text not null default 'scheduled'
    check (occurrence_status in ('scheduled','cancelled','postponed')),
  cancellation_reason text,
  source_updated_at timestamptz,
  provider_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(provider_metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, starts_at),
  check (ends_at is null or ends_at >= starts_at),
  check (occurrence_status = 'cancelled' or cancellation_reason is null)
);

create unique index if not exists event_occurrences_provider_id_uidx
  on public.event_occurrences(event_id, provider_occurrence_id)
  where provider_occurrence_id is not null;
create index if not exists events_publication_idx
  on public.events(publication_status, verification_status, event_status);
create index if not exists events_provider_transport_idx
  on public.events(provider, provider_transport_id)
  where provider_transport_id is not null;
create index if not exists events_source_group_idx
  on public.events(provider, source_group_id)
  where source_group_id is not null;
create index if not exists events_deduplication_idx on public.events(deduplication_key);
create index if not exists events_place_idx on public.events(place_id) where place_id is not null;
create index if not exists event_occurrences_time_idx on public.event_occurrences(starts_at, ends_at);
create index if not exists event_occurrences_fingerprint_idx on public.event_occurrences(occurrence_fingerprint);

alter table public.events enable row level security;
alter table public.event_occurrences enable row level security;

create policy "Authenticated users read published verified events" on public.events
  for select to authenticated
  using (publication_status = 'published' and verification_status = 'verified');

create policy "Authenticated users read published event occurrences" on public.event_occurrences
  for select to authenticated
  using (exists (
    select 1 from public.events event
    where event.id = event_id
      and event.publication_status = 'published'
      and event.verification_status = 'verified'
  ));

revoke insert, update, delete on public.events, public.event_occurrences from anon, authenticated;
grant select on public.events, public.event_occurrences to authenticated;

comment on table public.events is 'Provider-neutral curated event series/entity; never stores user activities.';
comment on table public.event_occurrences is 'Concrete event times with deterministic occurrence IDs and independent cancellation/postponement.';
comment on column public.events.provider_metadata is 'Non-secret provider metadata only; credentials and raw payloads are forbidden.';
comment on column public.events.recurrence_rule is 'RFC 5545 RRULE supplied by a trusted source; never inferred.';

-- ROLLBACK (review and run manually; deletes only this unapplied domain):
-- drop table if exists public.event_occurrences;
-- drop table if exists public.events;

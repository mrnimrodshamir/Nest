-- Curated, long-lived family-friendly destinations. This is deliberately
-- separate from time-specific activities and from transient place search.
create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  category text not null check (category in ('playground','park','indoor_playground','family_cafe','zoo_or_animals','museum','library','beach','pool','community_center','attraction','picnic_area','other')),
  short_description text,
  full_description text,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  formatted_address text,
  neighborhood text,
  city text not null default 'Tel Aviv-Yafo',
  country_code text not null default 'IL' check (country_code ~ '^[A-Z]{2}$'),
  provider text,
  provider_place_id text,
  website_url text,
  phone text,
  cover_image_url text,
  gallery_image_urls text[],
  is_indoor boolean,
  is_outdoor boolean,
  is_free boolean,
  price_note text,
  min_age_months integer check (min_age_months is null or min_age_months >= 0),
  max_age_months integer check (max_age_months is null or max_age_months >= 0),
  stroller_friendly boolean,
  changing_table boolean,
  high_chairs boolean,
  toilets boolean,
  shade boolean,
  water_fountain boolean,
  accessible boolean,
  parking_note text,
  opening_hours jsonb,
  source_name text,
  source_url text,
  verification_status text not null default 'draft' check (verification_status in ('draft','verified','needs_review','archived')),
  last_verified_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  location geography(point, 4326) generated always as (st_setsrid(st_makepoint(longitude, latitude), 4326)::geography) stored,
  check (min_age_months is null or max_age_months is null or min_age_months <= max_age_months)
);

create index if not exists places_category_idx on public.places(category);
create index if not exists places_city_idx on public.places(city);
create index if not exists places_active_idx on public.places(is_active);
create index if not exists places_verification_idx on public.places(verification_status);
create index if not exists places_location_gix on public.places using gist(location);
create unique index if not exists places_provider_id_uidx on public.places(provider, provider_place_id) where provider is not null and provider_place_id is not null;

alter table public.places enable row level security;
drop policy if exists "Authenticated users read curated places" on public.places;
create policy "Authenticated users read curated places" on public.places
  for select to authenticated
  using (is_active and verification_status = 'verified');

revoke insert, update, delete on public.places from anon, authenticated;
grant select on public.places to authenticated;

-- ROLLBACK (review only; do not run automatically):
-- drop table if exists public.places;

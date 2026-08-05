-- Production reconciliation for the reviewed local Places migrations 0006-0008.
--
-- Remote migration history predates those numbered files and uses timestamp
-- versions. This forward-only migration creates only the Places objects needed
-- by the current mobile release and controlled importer. It intentionally does
-- not create collections, quality views, or other later curation entities.

create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  category text not null,
  short_description text,
  full_description text,
  latitude double precision not null,
  longitude double precision not null,
  formatted_address text,
  neighborhood text,
  city text not null default 'Tel Aviv-Yafo',
  country_code text not null default 'IL',
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
  min_age_months integer,
  max_age_months integer,
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
  verification_status text not null default 'draft',
  last_verified_at timestamptz,
  is_active boolean not null default true,
  place_origin text not null default 'curated',
  is_featured boolean not null default false,
  featured_order integer,
  featured_until timestamptz,
  is_hidden boolean not null default false,
  editor_notes text,
  verified_by uuid references auth.users(id) on delete set null,
  last_reviewed_by uuid references auth.users(id) on delete set null,
  partner_tags text[],
  popularity_score integer not null default 0,
  external_id text,
  import_batch_id uuid,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  location geography(point, 4326) generated always as (
    st_setsrid(st_makepoint(longitude, latitude), 4326)::geography
  ) stored,
  search_document tsvector generated always as (
    to_tsvector(
      'simple'::regconfig,
      coalesce(name, '') || ' ' || coalesce(category, '') || ' ' ||
      coalesce(neighborhood, '') || ' ' || coalesce(short_description, '') || ' ' ||
      coalesce(full_description, '')
    )
  ) stored,
  constraint places_name_check check (length(trim(name)) > 0),
  constraint places_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint places_slug_key unique (slug),
  constraint places_category_check check (category in (
    'playground', 'park', 'indoor_playground', 'zoo_or_animals', 'museum', 'library',
    'beach', 'pool', 'community_center', 'attraction', 'picnic_area', 'other'
  )),
  constraint places_latitude_check check (latitude between -90 and 90),
  constraint places_longitude_check check (longitude between -180 and 180),
  constraint places_country_code_check check (country_code ~ '^[A-Z]{2}$'),
  constraint places_min_age_check check (min_age_months is null or min_age_months >= 0),
  constraint places_max_age_check check (max_age_months is null or max_age_months >= 0),
  constraint places_age_range_check check (
    min_age_months is null or max_age_months is null or min_age_months <= max_age_months
  ),
  constraint places_verification_status_check check (
    verification_status in ('draft', 'verified', 'needs_review', 'archived')
  ),
  constraint places_origin_check check (place_origin in ('curated', 'partner', 'municipality')),
  constraint places_featured_order_check check (featured_order is null or featured_order >= 0),
  constraint places_popularity_score_check check (popularity_score >= 0)
);

create index places_category_idx on public.places(category);
create index places_city_idx on public.places(city);
create index places_active_verification_idx on public.places(is_active, verification_status);
create index places_visibility_idx on public.places(is_active, is_hidden, verification_status);
create index places_viewport_idx on public.places(latitude, longitude);
create index places_location_gix on public.places using gist(location);
create index places_search_document_gin on public.places using gin(search_document);
create unique index places_provider_id_uidx
  on public.places(provider, provider_place_id)
  where provider is not null and provider_place_id is not null;
create unique index places_source_external_id_uidx
  on public.places(source_name, external_id)
  where source_name is not null and external_id is not null;
create index places_import_batch_idx on public.places(import_batch_id)
  where import_batch_id is not null;

alter table public.places enable row level security;

create policy "Authenticated users read curated places"
  on public.places
  for select
  to authenticated
  using (is_active and not is_hidden and verification_status = 'verified');

revoke all on table public.places from public, anon, authenticated;
grant select on table public.places to authenticated;

create or replace function public.search_curated_places(
  search_query text,
  result_limit integer default 40
)
returns setof public.places
language sql
stable
security invoker
set search_path = public
as $$
  select p.*
  from public.places p
  where p.is_active
    and not p.is_hidden
    and p.verification_status = 'verified'
    and length(trim(search_query)) >= 2
    and p.search_document @@ websearch_to_tsquery('simple'::regconfig, search_query)
  order by
    ts_rank(p.search_document, websearch_to_tsquery('simple'::regconfig, search_query)) desc,
    p.name asc,
    p.id asc
  limit least(greatest(result_limit, 1), 100);
$$;

revoke all on function public.search_curated_places(text, integer) from public, anon;
grant execute on function public.search_curated_places(text, integer) to authenticated;

comment on table public.places is
  'Curated, long-lived family-friendly destinations; separate from scheduled activities.';
comment on column public.places.external_id is
  'Stable identifier supplied by the named curation source, when available.';
comment on column public.places.import_batch_id is
  'Importer-generated batch UUID used for review and cleanup.';

-- ROLLBACK (review and run manually only):
-- drop function if exists public.search_curated_places(text, integer);
-- drop table if exists public.places;

-- Phase 2 curated Places administration and editorial collections.
-- Additive only: existing places and older mobile clients remain compatible.
alter table public.places
  add column if not exists place_origin text not null default 'curated',
  add column if not exists is_featured boolean not null default false,
  add column if not exists featured_order integer,
  add column if not exists featured_until timestamptz,
  add column if not exists is_hidden boolean not null default false,
  add column if not exists editor_notes text,
  add column if not exists verified_by uuid references auth.users(id) on delete set null,
  add column if not exists last_reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists partner_tags text[],
  add column if not exists popularity_score integer not null default 0,
  add column if not exists search_document tsvector generated always as (
    to_tsvector('simple'::regconfig,
      coalesce(name, '') || ' ' || coalesce(category, '') || ' ' ||
      coalesce(neighborhood, '') || ' ' || coalesce(short_description, '') || ' ' ||
      coalesce(full_description, '') || ' ' || coalesce(array_to_string(partner_tags, ' '), '')
    )
  ) stored;

alter table public.places
  drop constraint if exists places_origin_check,
  add constraint places_origin_check check (place_origin in ('curated', 'partner', 'municipality')),
  drop constraint if exists places_featured_order_check,
  add constraint places_featured_order_check check (featured_order is null or featured_order >= 0),
  drop constraint if exists places_popularity_score_check,
  add constraint places_popularity_score_check check (popularity_score >= 0);

create index if not exists places_search_document_gin on public.places using gin(search_document);
create index if not exists places_featured_idx on public.places(is_featured, featured_order, featured_until);
create index if not exists places_origin_idx on public.places(place_origin);
create index if not exists places_popularity_idx on public.places(popularity_score desc);
create index if not exists places_visibility_idx on public.places(is_active, is_hidden, verification_status);
create index if not exists places_viewport_idx on public.places(latitude, longitude);

drop policy if exists "Authenticated users read curated places" on public.places;
create policy "Authenticated users read curated places" on public.places
  for select to authenticated
  using (is_active and not is_hidden and verification_status = 'verified');

create table if not exists public.place_collections (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  cover_image_url text,
  collection_type text not null default 'standard' check (collection_type in ('standard','featured_this_week','editors_picks','popular_places')),
  is_active boolean not null default true,
  published_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at is null or ends_at is null or starts_at < ends_at)
);

create table if not exists public.place_collection_items (
  collection_id uuid not null references public.place_collections(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  display_order integer not null default 0 check (display_order >= 0),
  editor_note text,
  added_at timestamptz not null default now(),
  primary key (collection_id, place_id)
);

create index if not exists place_collections_type_idx on public.place_collections(collection_type, is_active);
create index if not exists place_collections_schedule_idx on public.place_collections(starts_at, ends_at);
create index if not exists place_collection_items_order_idx on public.place_collection_items(collection_id, display_order, place_id);
create index if not exists place_collection_items_place_idx on public.place_collection_items(place_id);

alter table public.place_collections enable row level security;
alter table public.place_collection_items enable row level security;

create policy "Authenticated users read published place collections" on public.place_collections
  for select to authenticated using (
    is_active and published_at is not null and published_at <= now()
    and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())
  );

create policy "Authenticated users read visible collection items" on public.place_collection_items
  for select to authenticated using (
    exists (
      select 1 from public.place_collections c
      where c.id = collection_id and c.is_active and c.published_at is not null and c.published_at <= now()
        and (c.starts_at is null or c.starts_at <= now()) and (c.ends_at is null or c.ends_at > now())
    )
    and exists (
      select 1 from public.places p
      where p.id = place_id and p.is_active and not p.is_hidden and p.verification_status = 'verified'
    )
  );

revoke insert, update, delete on public.place_collections, public.place_collection_items from anon, authenticated;
grant select on public.place_collections, public.place_collection_items to authenticated;

create or replace function public.search_curated_places(search_query text, result_limit integer default 40)
returns setof public.places
language sql
stable
security invoker
set search_path = public
as $$
  select p.*
  from public.places p
  where p.is_active and not p.is_hidden and p.verification_status = 'verified'
    and length(trim(search_query)) >= 2
    and (
      p.search_document @@ websearch_to_tsquery('simple'::regconfig, search_query)
      or exists (
        select 1
        from public.place_collection_items pci
        join public.place_collections pc on pc.id = pci.collection_id
        where pci.place_id = p.id and pc.is_active and pc.published_at is not null
          and to_tsvector('simple'::regconfig, pc.title || ' ' || coalesce(pc.description, ''))
            @@ websearch_to_tsquery('simple'::regconfig, search_query)
      )
    )
  order by ts_rank(p.search_document, websearch_to_tsquery('simple'::regconfig, search_query)) desc,
    p.name asc, p.id asc
  limit least(greatest(result_limit, 1), 100);
$$;

revoke all on function public.search_curated_places(text, integer) from public, anon;
grant execute on function public.search_curated_places(text, integer) to authenticated;

create or replace view public.place_curation_quality
with (security_invoker = true)
as
select
  p.id,
  p.name,
  greatest(0, 100
    - case when p.cover_image_url is null then 20 else 0 end
    - case when p.short_description is null and p.full_description is null then 15 else 0 end
    - case when p.opening_hours is null then 15 else 0 end
    - case when p.website_url is null then 10 else 0 end
    - case when p.accessible is null then 10 else 0 end
    - case when p.stroller_friendly is null and p.changing_table is null and p.high_chairs is null
             and p.toilets is null and p.shade is null and p.water_fountain is null then 30 else 0 end
  )::integer as completeness_score
from public.places p;

revoke all on public.place_curation_quality from public, anon, authenticated;
grant select on public.place_curation_quality to service_role;

-- ROLLBACK (review only; do not run automatically):
-- drop view if exists public.place_curation_quality;
-- drop function if exists public.search_curated_places(text, integer);
-- drop table if exists public.place_collection_items;
-- drop table if exists public.place_collections;
-- drop policy if exists "Authenticated users read curated places" on public.places;
-- alter table public.places drop column if exists search_document, drop column if exists popularity_score,
--   drop column if exists partner_tags, drop column if exists last_reviewed_by, drop column if exists verified_by,
--   drop column if exists editor_notes, drop column if exists is_hidden, drop column if exists featured_until,
--   drop column if exists featured_order, drop column if exists is_featured, drop column if exists place_origin;
-- recreate the Phase 1 places SELECT policy from migration 0006 before rollback is considered complete.

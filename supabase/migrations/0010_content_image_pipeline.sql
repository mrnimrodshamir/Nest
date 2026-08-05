-- Sprint 8 provider-neutral image pipeline. Additive and local-only until approved.
-- Existing cover_image_url, gallery_image_urls, and events.image_url remain readable.
create table if not exists public.content_images (
  id uuid primary key default gen_random_uuid(),
  original_url text not null check (original_url ~ '^https://'),
  original_sha256 text not null check (original_sha256 ~ '^[0-9a-f]{64}$'),
  alt_text text not null check (length(trim(alt_text)) > 0),
  placeholder text,
  source_type text not null check (source_type in ('official','provider','municipality','curated')),
  source_name text not null check (length(trim(source_name)) > 0),
  source_url text check (source_url is null or source_url ~ '^https://'),
  attribution_text text,
  attribution_url text check (attribution_url is null or attribution_url ~ '^https://'),
  license text not null check (license in ('owned','permission_granted','public_domain','cc_by','cc_by_sa','open_data','unknown')),
  license_url text check (license_url is null or license_url ~ '^https://'),
  rights_status text not null default 'pending' check (rights_status in ('pending','approved','rejected')),
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (original_sha256),
  check (rights_status <> 'approved' or (license <> 'unknown' and verified_at is not null))
);

create table if not exists public.content_image_variants (
  id uuid primary key default gen_random_uuid(),
  image_id uuid not null references public.content_images(id) on delete cascade,
  variant text not null check (variant in ('thumbnail','card','cover','gallery')),
  url text not null check (url ~ '^https://'),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','image/avif')),
  byte_size bigint check (byte_size is null or byte_size > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (image_id, variant),
  unique (sha256)
);

create table if not exists public.place_content_images (
  place_id uuid not null references public.places(id) on delete cascade,
  image_id uuid not null references public.content_images(id) on delete restrict,
  role text not null check (role in ('thumbnail','card','cover','gallery')),
  display_order integer not null default 0 check (display_order >= 0),
  primary key (place_id, image_id, role),
  unique (place_id, role, display_order)
);

create table if not exists public.event_content_images (
  event_id uuid not null references public.events(id) on delete cascade,
  image_id uuid not null references public.content_images(id) on delete restrict,
  role text not null check (role in ('thumbnail','card','cover','gallery')),
  display_order integer not null default 0 check (display_order >= 0),
  primary key (event_id, image_id, role),
  unique (event_id, role, display_order)
);

create index if not exists content_images_source_idx on public.content_images(source_type, source_name);
create index if not exists content_images_rights_idx on public.content_images(rights_status, verified_at);
create index if not exists place_content_images_order_idx on public.place_content_images(place_id, role, display_order);
create index if not exists event_content_images_order_idx on public.event_content_images(event_id, role, display_order);

alter table public.content_images enable row level security;
alter table public.content_image_variants enable row level security;
alter table public.place_content_images enable row level security;
alter table public.event_content_images enable row level security;

create policy "Authenticated users read approved images" on public.content_images
  for select to authenticated using (rights_status = 'approved');
create policy "Authenticated users read approved image variants" on public.content_image_variants
  for select to authenticated using (exists (
    select 1 from public.content_images image where image.id = image_id and image.rights_status = 'approved'
  ));
create policy "Authenticated users read visible place images" on public.place_content_images
  for select to authenticated using (exists (
    select 1 from public.places place where place.id = place_id and place.is_active and place.verification_status = 'verified'
  ));
create policy "Authenticated users read visible event images" on public.event_content_images
  for select to authenticated using (exists (
    select 1 from public.events event where event.id = event_id and event.publication_status = 'published' and event.verification_status = 'verified'
  ));

revoke insert, update, delete on public.content_images, public.content_image_variants, public.place_content_images, public.event_content_images from anon, authenticated;
grant select on public.content_images, public.content_image_variants, public.place_content_images, public.event_content_images to authenticated;

comment on table public.content_images is 'Canonical licensed image assets shared by curated Places and Events; no scraped images.';
comment on column public.content_images.original_sha256 is 'Lowercase SHA-256 used for exact-byte duplicate detection.';
comment on column public.content_images.placeholder is 'Optional BlurHash or compact placeholder value; never the original image payload.';

-- ROLLBACK (review and run manually; existing legacy URL columns are untouched):
-- drop table if exists public.event_content_images;
-- drop table if exists public.place_content_images;
-- drop table if exists public.content_image_variants;
-- drop table if exists public.content_images;

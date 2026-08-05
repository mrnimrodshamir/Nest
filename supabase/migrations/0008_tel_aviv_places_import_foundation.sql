-- Narrows the currently approved Tel Aviv category set and adds traceable
-- import identity/batch metadata. Additive data changes only; no rows are
-- imported by this migration.
do $$
begin
  if exists (select 1 from public.places where category = 'family_cafe') then
    raise exception 'Cannot remove family_cafe while places still use it; review those rows manually first';
  end if;
end;
$$;

alter table public.places
  drop constraint if exists places_category_check,
  add constraint places_category_check check (category in (
    'playground','park','indoor_playground','zoo_or_animals','museum','library',
    'beach','pool','community_center','attraction','picnic_area','other'
  )),
  add column if not exists external_id text,
  add column if not exists import_batch_id uuid,
  add column if not exists imported_at timestamptz;

create unique index if not exists places_source_external_id_uidx
  on public.places(source_name, external_id)
  where source_name is not null and external_id is not null;
create index if not exists places_import_batch_idx on public.places(import_batch_id)
  where import_batch_id is not null;

comment on column public.places.external_id is 'Stable identifier supplied by the named curation source, when available.';
comment on column public.places.import_batch_id is 'Importer-generated batch UUID used for review and cleanup.';

-- CLEANUP FOR A NEW-ROWS-ONLY BATCH (review and run manually):
-- delete from public.places where import_batch_id = '<BATCH_UUID>';
-- Updates require the importer-generated before-state backup to restore.

-- ROLLBACK (review only; does not modify place rows):
-- drop index if exists public.places_import_batch_idx;
-- drop index if exists public.places_source_external_id_uidx;
-- alter table public.places drop constraint if exists places_category_check;
-- alter table public.places add constraint places_category_check check (category in
--   ('playground','park','indoor_playground','family_cafe','zoo_or_animals','museum','library','beach','pool','community_center','attraction','picnic_area','other'));
-- alter table public.places drop column if exists imported_at, drop column if exists import_batch_id, drop column if exists external_id;

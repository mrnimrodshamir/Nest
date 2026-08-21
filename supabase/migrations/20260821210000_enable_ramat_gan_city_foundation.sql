-- Ramat Gan supervised production foundation. Additive and backward-compatible.
create table if not exists public.city_registry (
  city_id text primary key check (city_id ~ '^[a-z0-9_]+$'),
  canonical_name text not null,
  localized_names jsonb not null,
  country_code text not null default 'IL' check (country_code = 'IL'),
  timezone text not null default 'Asia/Jerusalem' check (timezone = 'Asia/Jerusalem'),
  currency text not null default 'ILS' check (currency = 'ILS'),
  center_latitude double precision not null check (center_latitude between -90 and 90),
  center_longitude double precision not null check (center_longitude between -180 and 180),
  default_radius_m integer not null check (default_radius_m between 1000 and 50000),
  boundary_source_url text not null,
  boundary_source_code text not null,
  boundary_bounds jsonb not null,
  enabled boolean not null default false,
  digest_enabled boolean not null default false,
  autonomy_level smallint not null default 2 check (autonomy_level = 2),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

insert into public.city_registry(city_id,canonical_name,localized_names,center_latitude,center_longitude,default_radius_m,boundary_source_url,boundary_source_code,boundary_bounds,enabled,digest_enabled)
values
('tel_aviv','Tel Aviv-Yafo','{"en":"Tel Aviv-Yafo","he":"תל אביב-יפו","fr":"Tel-Aviv-Jaffa","ru":"Тель-Авив-Яффо","ar":"تل أبيب-يافا","es":"Tel Aviv-Yafo"}',32.0853,34.7818,12000,'https://gisn.tel-aviv.gov.il/','tel_aviv_yafo','{"south":32.02,"west":34.73,"north":32.15,"east":34.84}',true,true),
('ramat_gan','Ramat Gan','{"en":"Ramat Gan","he":"רמת גן","fr":"Ramat Gan","ru":"Рамат-Ган","ar":"رمات غان","es":"Ramat Gan"}',32.0821,34.8148,6000,'https://ags.iplan.gov.il/arcgisiplan/rest/services/PlanningPublic/gvulot_retzef/MapServer/1','8600','{"south":32.0360822,"west":34.7991359,"north":32.105566,"east":34.8547491}',false,false)
on conflict(city_id) do update set canonical_name=excluded.canonical_name,localized_names=excluded.localized_names,timezone=excluded.timezone,currency=excluded.currency,center_latitude=excluded.center_latitude,center_longitude=excluded.center_longitude,default_radius_m=excluded.default_radius_m,boundary_source_url=excluded.boundary_source_url,boundary_source_code=excluded.boundary_source_code,boundary_bounds=excluded.boundary_bounds,updated_at=now();

alter table public.city_registry enable row level security;
drop policy if exists city_registry_read_enabled on public.city_registry;
create policy city_registry_read_enabled on public.city_registry for select to anon,authenticated using(enabled);
revoke all on public.city_registry from anon,authenticated;
grant select on public.city_registry to anon,authenticated;
grant all on public.city_registry to service_role;

alter table public.events add column if not exists city_id text not null default 'tel_aviv' references public.city_registry(city_id);
create index if not exists events_city_publication_idx on public.events(city_id,publication_status,is_visible);
alter table public.provider_registry add column if not exists city_id text references public.city_registry(city_id);
update public.provider_registry set city_id='tel_aviv' where city_id is null;
alter table public.provider_registry alter column city_id set not null;

insert into public.provider_registry(key,name,source_type,base_url,connector_type,enabled,schedule_cron,trust_level,default_city,city_id)
values('ramat_gan_beit_emanuel','Beit Emanuel Ramat Gan','external_organizer','https://mbe-rg.smarticket.co.il/','html_extraction',false,null,'trusted','Ramat Gan','ramat_gan')
on conflict(key) do update set name=excluded.name,source_type=excluded.source_type,base_url=excluded.base_url,connector_type=excluded.connector_type,default_city=excluded.default_city,city_id=excluded.city_id,updated_at=now();

create or replace function public.assign_event_city_from_provider() returns trigger language plpgsql set search_path=public as $$
begin
  if new.provider is not null then select coalesce(city_id,'tel_aviv') into new.city_id from public.provider_registry where key=new.provider; end if;
  new.city_id := coalesce(new.city_id,'tel_aviv'); return new;
end $$;
drop trigger if exists assign_event_city_from_provider on public.events;
create trigger assign_event_city_from_provider before insert or update of provider on public.events for each row execute function public.assign_event_city_from_provider();

create or replace view public.active_event_occurrences as
select o.id occurrence_id,o.event_id,o.provider_occurrence_id,o.occurrence_fingerprint,o.starts_at,o.ends_at,o.original_starts_at,o.occurrence_status,o.cancellation_reason occurrence_cancellation_reason,o.source_updated_at occurrence_source_updated_at,o.provider_metadata occurrence_provider_metadata,
 e.title,e.description,e.category,e.image_url,e.age_min_months,e.age_max_months,e.price_note,e.registration_required,e.registration_url,e.verification_status,e.publication_status,e.event_status,e.cancellation_reason,e.provider,e.provider_event_id,e.provider_transport_id,e.source_group_id,e.source_name,e.source_url,e.source_published_at,e.source_updated_at,e.provider_metadata,e.is_recurring,e.recurrence_rule,e.recurrence_timezone,e.recurrence_series_id,e.place_id,e.location_name,e.formatted_address,e.latitude,e.longitude,e.created_at,e.updated_at,e.source_type,e.canonical_event_id,e.city_id
from public.event_occurrences o join public.events e on e.id=o.event_id
where e.publication_status='published' and e.verification_status='verified' and e.is_visible
 and coalesce(o.ends_at,o.starts_at)>=now() and o.occurrence_status is distinct from 'cancelled'
 and e.event_status is distinct from 'cancelled' and o.archived_at is null;

alter table public.city_expansion_runs drop constraint if exists city_expansion_runs_current_stage_check;
alter table public.city_expansion_runs add constraint city_expansion_runs_current_stage_check check(current_stage in('city_profile','source_discovery','source_review','provider_analysis','connector_draft','dry_run','quality_review','localization_review','expansion_scoring','awaiting_human_approval','approved','rejected','production_prepared','production_enabled'));
alter table public.approval_requests add column if not exists decision_authority text;
alter table public.approval_requests drop constraint if exists approval_requests_check;
alter table public.approval_requests add constraint approval_requests_decision_audit_check check(
 (status='PENDING' and decided_by is null and decided_at is null and decision_authority is null)
 or (status<>'PENDING' and decided_at is not null and (decided_by is not null or decision_authority='explicit_operator_instruction'))
);

comment on table public.city_registry is 'Public non-sensitive city configuration. Internal expansion state remains service-role-only control-plane tables.';
-- ROLLBACK (manual review only): disable ramat_gan and its provider first; drop trigger/function; recreate the previous active_event_occurrences view without city_id; drop events/provider_registry city_id only after proving no dependent client; drop city_registry.

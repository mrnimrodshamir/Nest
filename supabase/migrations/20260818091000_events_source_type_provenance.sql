-- Three additive columns on public.events, closing the gap between what the
-- table already tracked per-EVENT (source_url, source_name — both correct and
-- unchanged) and what the provider system needs to track about the SOURCE
-- itself: what kind of source it is, and where its home page lives.
--
-- source_type classifies the row for UI differentiation (Section 2 of the
-- design: municipal content must not read as commercially endorsed, external
-- content must not read as municipality-published, and neither may read as
-- NestUp-organized). Deliberately excludes 'nestup_community': this table
-- never holds user-created Activities — those live in public.activities and
-- are architecturally separate (see 0009_events_domain.sql's own comment:
-- "never stores user activities"). The broader three-way SourceBadge type
-- used by the UI layer is a TypeScript-only concern, computed per screen, not
-- a database constraint.
--
-- provider_url is the provider's BASE url (e.g. https://ariela.today) —
-- distinct from the existing per-event source_url, which points at that
-- specific event's page. Both are useful: provider_url answers "who is this
-- from," source_url answers "where did THIS event come from."
--
-- canonical_event_id is schema for cross-provider dedupe, laid down now so a
-- later migration is not needed purely to add it, but intentionally UNUSED by
-- any code in this change. Per the design brief, only an EXACT match may ever
-- be auto-linked, and Phase B ships classification and reporting only — no
-- code path writes to this column yet. It exists so the eventual linking
-- logic has somewhere to write without another schema change.

alter table public.events add column if not exists source_type text;
alter table public.events add column if not exists provider_url text;
alter table public.events add column if not exists canonical_event_id uuid references public.events(id);

update public.events set source_type = 'municipal'
where source_type is null and provider = 'tel_aviv_digitel';

update public.events set provider_url = 'https://www.tel-aviv.gov.il'
where provider_url is null and provider = 'tel_aviv_digitel';

-- Enforced only after backfill, so this migration can never fail on an
-- existing row it forgot to cover.
alter table public.events
  add constraint events_source_type_check
  check (source_type is null or source_type in ('municipal', 'external_organizer'));

alter table public.events
  add constraint events_canonical_event_id_not_self
  check (canonical_event_id is distinct from id);

create index if not exists events_canonical_event_id_idx
  on public.events(canonical_event_id) where canonical_event_id is not null;

comment on column public.events.source_type is
  'municipal | external_organizer. Never nestup_community — user-created Activities are a separate table entirely.';
comment on column public.events.provider_url is
  'The PROVIDER''s base URL (e.g. https://ariela.today). Distinct from source_url, which is this specific event''s page.';
comment on column public.events.canonical_event_id is
  'Set only by an explicit EXACT-match cross-provider link. Nothing in this migration or its accompanying code populates it — schema laid down ahead of the linking logic so that later work is not another migration.';

-- ROLLBACK (review and run manually only):
-- alter table public.events drop constraint if exists events_canonical_event_id_not_self;
-- alter table public.events drop constraint if exists events_source_type_check;
-- drop index if exists events_canonical_event_id_idx;
-- alter table public.events drop column if exists canonical_event_id;
-- alter table public.events drop column if exists provider_url;
-- alter table public.events drop column if exists source_type;

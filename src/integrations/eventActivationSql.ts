import type { ActivationEvent } from '@/integrations/digitelActivation';
import { assertActivationBatch } from '@/integrations/digitelActivation';

export function buildActivationImportSql(events: ActivationEvent[], batchId: string, generatedAt: string): string {
  assertActivationBatch(events);
  if (!/^digitel-sprint9-[a-z0-9-]+$/.test(batchId)) throw new Error('Invalid activation batch ID');
  const seenAt = timestamp(generatedAt);
  const rows = events.map((event) => `(${[
    text(event.provider), text(event.providerEventId), text(event.providerTransportId), nullable(event.sourceGroupId),
    text(event.occurrenceId), text(event.occurrenceFingerprint), text(event.title), nullable(event.description), text(event.category),
    text(event.startsAt), nullable(event.placeId), text(event.locationName), number(event.latitude), number(event.longitude),
    text(event.sourceName), text(event.sourceUrl), nullable(event.sourcePublishedAt), nullable(event.sourceUpdatedAt),
  ].join(',')})`).join(',\n');
  return `-- Generated controlled Sprint 9 import. PASS records only; no source images.\n` +
`begin;\nset local lock_timeout = '10s';\nset local statement_timeout = '60s';\n` +
`create temp table sprint9_import (provider text, provider_event_id text, provider_transport_id text, source_group_id text, occurrence_id text, occurrence_fingerprint text, title text, description text, category text, starts_at timestamptz, place_id uuid, location_name text, latitude double precision, longitude double precision, source_name text, source_url text, source_published_at timestamptz, source_updated_at timestamptz) on commit drop;\n` +
`insert into sprint9_import values\n${rows};\n` +
`do $$ begin if (select count(*) from sprint9_import) <> ${events.length} then raise exception 'Unexpected import payload count'; end if; if exists (select 1 from sprint9_import group by provider, provider_event_id having count(*) > 1) then raise exception 'Duplicate provider identity'; end if; if exists (select 1 from sprint9_import group by occurrence_fingerprint having count(*) > 1) then raise exception 'Duplicate fingerprint'; end if; end $$;\n` +
`insert into public.events (title,description,category,image_url,age_min_months,age_max_months,price_note,registration_required,registration_url,verification_status,publication_status,is_visible,event_status,cancellation_reason,provider,provider_event_id,provider_transport_id,source_group_id,source_name,source_url,source_published_at,source_updated_at,provider_metadata,is_recurring,recurrence_rule,recurrence_timezone,recurrence_series_id,place_id,location_name,formatted_address,latitude,longitude,deduplication_key,import_batch_id,first_seen_at,last_seen_at)\n` +
`select title,description,category,null,null,null,null,null,null,'verified','published',true,'scheduled',null,provider,provider_event_id,provider_transport_id,source_group_id,source_name,source_url,source_published_at,source_updated_at,'{}'::jsonb,false,null,'Asia/Jerusalem',null,place_id,location_name,null,latitude,longitude,occurrence_fingerprint,${text(batchId)},${seenAt},${seenAt} from sprint9_import\n` +
`on conflict (provider, provider_event_id) do update set title=excluded.title,description=excluded.description,category=excluded.category,provider_transport_id=excluded.provider_transport_id,source_group_id=excluded.source_group_id,source_name=excluded.source_name,source_url=excluded.source_url,source_published_at=excluded.source_published_at,source_updated_at=excluded.source_updated_at,place_id=excluded.place_id,location_name=excluded.location_name,latitude=excluded.latitude,longitude=excluded.longitude,deduplication_key=excluded.deduplication_key,import_batch_id=excluded.import_batch_id,last_seen_at=excluded.last_seen_at,updated_at=now()\n` +
`where (events.title,events.description,events.category,events.provider_transport_id,events.source_group_id,events.source_url,events.source_published_at,events.source_updated_at,events.place_id,events.location_name,events.latitude,events.longitude) is distinct from (excluded.title,excluded.description,excluded.category,excluded.provider_transport_id,excluded.source_group_id,excluded.source_url,excluded.source_published_at,excluded.source_updated_at,excluded.place_id,excluded.location_name,excluded.latitude,excluded.longitude);\n` +
`insert into public.event_occurrences (id,event_id,provider_occurrence_id,occurrence_fingerprint,starts_at,ends_at,original_starts_at,occurrence_status,cancellation_reason,source_updated_at,provider_metadata,import_batch_id)\n` +
`select source.occurrence_id,event.id,source.provider_transport_id,source.occurrence_fingerprint,source.starts_at,null,null,'scheduled',null,source.source_updated_at,'{}'::jsonb,${text(batchId)} from sprint9_import source join public.events event on event.provider=source.provider and event.provider_event_id=source.provider_event_id\n` +
`on conflict (id) do update set event_id=excluded.event_id,provider_occurrence_id=excluded.provider_occurrence_id,occurrence_fingerprint=excluded.occurrence_fingerprint,starts_at=excluded.starts_at,source_updated_at=excluded.source_updated_at,import_batch_id=excluded.import_batch_id,updated_at=now()\n` +
`where (event_occurrences.event_id,event_occurrences.provider_occurrence_id,event_occurrences.occurrence_fingerprint,event_occurrences.starts_at,event_occurrences.source_updated_at) is distinct from (excluded.event_id,excluded.provider_occurrence_id,excluded.occurrence_fingerprint,excluded.starts_at,excluded.source_updated_at);\n` +
`do $$ begin if (select count(*) from public.events where provider='tel_aviv_digitel' and is_visible and verification_status='verified' and publication_status='published') <> ${events.length} then raise exception 'Unexpected published Event count'; end if; if (select count(*) from public.event_occurrences occurrence join public.events event on event.id=occurrence.event_id where event.provider='tel_aviv_digitel') <> ${events.length} then raise exception 'Unexpected occurrence count'; end if; end $$;\ncommit;\n`;
}

function text(value: string): string { return `'${value.replace(/'/g, "''")}'`; }
function nullable(value: string | null): string { return value == null ? 'null' : text(value); }
function timestamp(value: string): string { if (!Number.isFinite(Date.parse(value))) throw new Error('Invalid generated timestamp'); return `${text(new Date(value).toISOString())}::timestamptz`; }
function number(value: number): string { if (!Number.isFinite(value)) throw new Error('Invalid numeric SQL value'); return String(value); }

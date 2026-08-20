import { supabase } from '@/lib/supabase';
import type { EventDetails } from '@/types/event';
import type { PlaceViewport } from '@/types/familyFriendlyPlace';
import { mapEventDetails, type EventOccurrenceRow, type EventRow } from '@/utils/eventMapping';
import type { AppLocale } from '@/i18n';
import {
  applyCachedEventTranslation,
  detectEventSourceLanguage,
  type CachedEventTranslation,
} from '../../supabase/functions/_shared/eventTranslation';
import {
  selectDigestEvents,
  TEL_AVIV_CENTER,
  DEFAULT_DIGEST_RADIUS_KM,
  DEFAULT_DIGEST_MIN_RESULTS,
  DEFAULT_DIGEST_MAX_RESULTS,
  type DigestCandidateOccurrence,
} from '../../supabase/functions/_shared/dailyDigest/selectDigestEvents';
import { jerusalemLocalDateString } from '../../supabase/functions/_shared/dailyDigest/scheduleGate';
import { rowsInDigestOrder } from '@/utils/dailyDigestRows';

export const EVENT_COLUMNS = 'id,title,description,category,image_url,age_min_months,age_max_months,price_note,registration_required,registration_url,verification_status,publication_status,event_status,cancellation_reason,provider,provider_event_id,provider_transport_id,source_group_id,source_name,source_url,source_published_at,source_updated_at,provider_metadata,is_recurring,recurrence_rule,recurrence_timezone,recurrence_series_id,place_id,location_name,formatted_address,latitude,longitude,created_at,updated_at';
export const EVENT_OCCURRENCE_COLUMNS = 'id,event_id,provider_occurrence_id,occurrence_fingerprint,starts_at,ends_at,original_starts_at,occurrence_status,cancellation_reason,source_updated_at,provider_metadata';

const DISCOVERY_EVENT_LIMIT = 200;
const DISCOVERY_HORIZON_DAYS = 90;

/** The database view that already excludes finished, cancelled and archived
 *  occurrences. Reading from it means the row limit is spent on events a parent
 *  can actually attend.
 *
 *  Selecting events first and discarding finished occurrences afterwards — the
 *  previous shape — looks equivalent and is not: dead events still consume the
 *  200-row budget. With a scheduler appending occurrences every six hours, the
 *  accumulated finished ones would eventually fill the limit and Discovery would
 *  quietly go empty while the table was full. Filtering must precede the limit,
 *  which means it belongs in the database. */
const ACTIVE_EVENTS_VIEW = 'active_event_occurrences';

export async function queryDiscoveryEvents(viewport: PlaceViewport, now = new Date()): Promise<EventDetails[]> {
  validateViewport(viewport);
  const horizonEnd = new Date(startOfLocalDay(now).getTime() + DISCOVERY_HORIZON_DAYS * 24 * 60 * 60 * 1_000);
  const { data, error } = await supabase
    .from(ACTIVE_EVENTS_VIEW)
    .select('*')
    .gte('latitude', viewport.south)
    .lte('latitude', viewport.north)
    .gte('longitude', viewport.west)
    .lte('longitude', viewport.east)
    .lt('starts_at', horizonEnd.toISOString())
    .order('starts_at', { ascending: true })
    .limit(DISCOVERY_EVENT_LIMIT);
  if (error) throw new Error(error.message);
  return mapActiveRows(data ?? [], now);
}

export async function queryEventsAtPlace(placeId: string, now = new Date()): Promise<EventDetails[]> {
  if (!placeId.trim()) return [];
  const horizonEnd = new Date(startOfLocalDay(now).getTime() + DISCOVERY_HORIZON_DAYS * 24 * 60 * 60 * 1_000);
  const { data, error } = await supabase
    .from(ACTIVE_EVENTS_VIEW)
    .select('*')
    .eq('place_id', placeId)
    .lt('starts_at', horizonEnd.toISOString())
    .order('starts_at', { ascending: true })
    .limit(DISCOVERY_EVENT_LIMIT);
  if (error) throw new Error(error.message);
  return mapActiveRows(data ?? [], now);
}

/** Counts only NestUp RSVPs. It intentionally selects no profiles: Discovery
 * needs a small social signal, not attendee identities. */
export async function queryEventAttendanceCounts(occurrenceIds: readonly string[]): Promise<Record<string, number>> {
  const uniqueIds = [...new Set(occurrenceIds.filter(Boolean))];
  if (uniqueIds.length === 0) return {};
  const { data, error } = await supabase
    .from('event_attendees')
    .select('event_occurrence_id')
    .in('event_occurrence_id', uniqueIds);
  if (error) throw new Error(error.message);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const id = row.event_occurrence_id as string;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

/** The event-translation cache only ever has entries for the locales the
 *  translation pipeline populates. Arabic and Spanish have no cached rows yet
 *  — querying with an unsupported locale would either be a no-op or force
 *  {@link CachedEventTranslation}'s locale type wider than the cache actually
 *  supports, so those locales skip the cache and get provider content as-is,
 *  same as any other cache miss. */
const CACHED_EVENT_LOCALES: readonly CachedEventTranslation['locale'][] = ['en', 'he', 'fr', 'ru'];

function isCachedEventLocale(locale: AppLocale): locale is CachedEventTranslation['locale'] {
  return (CACHED_EVENT_LOCALES as readonly string[]).includes(locale);
}

/** Adds only a fingerprint-valid cached translation. Any cache/RLS/network
 * failure returns the original provider content and never hides an Event. */
export async function localizeEvents(events: readonly EventDetails[], locale: AppLocale): Promise<EventDetails[]> {
  const originals = events.map(({ localizedContent: _localizedContent, ...event }) => event as EventDetails);
  if (!isCachedEventLocale(locale)) return originals;
  const candidates = originals.filter((event) => detectEventSourceLanguage(event) !== locale);
  if (candidates.length === 0) return originals;
  try {
    const { data, error } = await supabase.from('event_content_translations')
      .select('event_id,locale,translated_title,translated_description,source_language,source_fingerprint')
      .eq('locale', locale)
      .in('event_id', [...new Set(candidates.map((event) => event.id))]);
    if (error) return originals;
    const byEvent = new Map<string, CachedEventTranslation>((data ?? []).map((row) => [row.event_id as string, {
      locale: row.locale as CachedEventTranslation['locale'],
      title: row.translated_title as string,
      description: (row.translated_description as string | null) ?? null,
      sourceLanguage: row.source_language as CachedEventTranslation['sourceLanguage'],
      sourceFingerprint: row.source_fingerprint as string,
    }]));
    return originals.map((event) => applyCachedEventTranslation(event, byEvent.get(event.id)));
  } catch {
    return originals;
  }
}

/** Today's Daily Digest events for Discovery-quality Tel Aviv content — runs
 *  the EXACT same selection/ranking (`selectDigestEvents`) the server-side
 *  `send-daily-digest` function used to decide what to push, so a user who
 *  opens the digest from the notification sees the same events, in the same
 *  order, that the push told them about — not an independently-computed
 *  second opinion. Never queries `daily_digest_instances` (RLS-closed to
 *  clients on purpose): re-deriving the same deterministic selection from
 *  `active_event_occurrences` is simpler than adding client read access to a
 *  server-analytics table, and produces an identical result. */
export async function queryDailyDigestEvents(now: Date = new Date()): Promise<EventDetails[]> {
  const localDate = jerusalemLocalDateString(now);
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('active_event_occurrences')
    .select('*')
    .gte('starts_at', windowStart)
    .lte('starts_at', windowEnd);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const candidates: DigestCandidateOccurrence[] = rows.map((row: any) => ({
    occurrenceId: row.occurrence_id,
    eventId: row.event_id,
    title: row.title,
    category: row.category,
    startsAt: row.starts_at,
    ageMinMonths: row.age_min_months,
    ageMaxMonths: row.age_max_months,
    priceNote: row.price_note,
    provider: row.provider,
    sourceName: row.source_name,
    sourceType: row.source_type,
    canonicalEventId: row.canonical_event_id,
    latitude: row.latitude,
    longitude: row.longitude,
    locationName: row.location_name,
  }));
  const selected = selectDigestEvents(candidates, {
    localDate,
    targetLatitude: TEL_AVIV_CENTER.latitude,
    targetLongitude: TEL_AVIV_CENTER.longitude,
    maxRadiusKm: DEFAULT_DIGEST_RADIUS_KM,
    minResults: DEFAULT_DIGEST_MIN_RESULTS,
    maxResults: DEFAULT_DIGEST_MAX_RESULTS,
  });
  const selectedRows = rowsInDigestOrder(rows as Array<{ occurrence_id: string }>, selected.map((event) => event.occurrenceId));
  return mapActiveRows(selectedRows, now);
}

/** Splits a joined view row back into the event and occurrence shapes the
 *  existing mapper expects, so no presentation logic changes. */
function mapActiveRows(rows: readonly unknown[], now: Date): EventDetails[] {
  return rows.flatMap((raw) => {
    const row = raw as Record<string, unknown>;
    const occurrence = {
      id: row.occurrence_id,
      event_id: row.event_id,
      provider_occurrence_id: row.provider_occurrence_id,
      occurrence_fingerprint: row.occurrence_fingerprint,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      original_starts_at: row.original_starts_at,
      occurrence_status: row.occurrence_status,
      cancellation_reason: row.occurrence_cancellation_reason,
      source_updated_at: row.occurrence_source_updated_at,
      provider_metadata: row.occurrence_provider_metadata,
    } as unknown as EventOccurrenceRow;
    const details = mapEventDetails({ ...row, id: row.event_id } as unknown as EventRow, occurrence, now);
    // The view already excludes finished occurrences, but `now` here is the
    // client's clock and the view used the database's. Keep the guard so a
    // skewed device cannot surface an event that has just ended.
    return details.lifecycle === 'finished' ? [] : [details];
  }).sort((left, right) =>
    Date.parse(left.occurrence.startsAt) - Date.parse(right.occurrence.startsAt)
    || left.occurrence.id.localeCompare(right.occurrence.id));
}

export async function getEventDetails(occurrenceId: string, now = new Date()): Promise<EventDetails> {
  const { data: occurrenceData, error: occurrenceError } = await supabase
    .from('event_occurrences')
    .select(EVENT_OCCURRENCE_COLUMNS)
    .eq('id', occurrenceId)
    .single();
  if (occurrenceError) throw new Error(occurrenceError.message);
  const occurrence = occurrenceData as unknown as EventOccurrenceRow;
  const { data: eventData, error: eventError } = await supabase
    .from('events')
    .select(EVENT_COLUMNS)
    .eq('id', occurrence.event_id)
    .eq('publication_status', 'published')
    .eq('verification_status', 'verified')
    .single();
  if (eventError) throw new Error(eventError.message);
  return mapEventDetails(eventData as unknown as EventRow, occurrence, now);
}

async function loadOccurrences(eventRows: EventRow[], now: Date, horizonDays: number): Promise<EventDetails[]> {
  if (eventRows.length === 0) return [];
  const start = startOfLocalDay(now);
  const end = new Date(start.getTime() + horizonDays * 24 * 60 * 60 * 1_000);
  const { data, error } = await supabase
    .from('event_occurrences')
    .select(EVENT_OCCURRENCE_COLUMNS)
    .in('event_id', eventRows.map((event) => event.id))
    .gte('starts_at', start.toISOString())
    .lt('starts_at', end.toISOString())
    .order('starts_at', { ascending: true })
    .limit(DISCOVERY_EVENT_LIMIT);
  if (error) throw new Error(error.message);
  const eventsById = new Map(eventRows.map((event) => [event.id, event]));
  return ((data ?? []) as unknown as EventOccurrenceRow[]).flatMap((occurrence) => {
    const event = eventsById.get(occurrence.event_id);
    if (!event) return [];
    const details = mapEventDetails(event, occurrence, now);
    return details.lifecycle === 'finished' ? [] : [details];
  }).sort((left, right) => Date.parse(left.occurrence.startsAt) - Date.parse(right.occurrence.startsAt) || left.occurrence.id.localeCompare(right.occurrence.id));
}

function startOfLocalDay(now: Date): Date {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = Object.fromEntries(formatter.formatToParts(now).flatMap((part) => part.type === 'literal' ? [] : [[part.type, part.value]]));
  const approximateUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  // Jerusalem is UTC+2 or UTC+3. Resolve midnight by asking Intl for the
  // offset at the approximate instant instead of hardcoding daylight saving.
  const offset = timezoneOffsetMilliseconds(new Date(approximateUtc), 'Asia/Jerusalem');
  return new Date(approximateUtc - offset);
}

function timezoneOffsetMilliseconds(date: Date, timezone: string): number {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date).flatMap((part) => part.type === 'literal' ? [] : [[part.type, part.value]]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second)) - date.getTime();
}

function validateViewport(viewport: PlaceViewport): void {
  if (![viewport.north, viewport.south, viewport.east, viewport.west].every(Number.isFinite)
    || viewport.south > viewport.north || viewport.west > viewport.east
    || viewport.south < -90 || viewport.north > 90 || viewport.west < -180 || viewport.east > 180) {
    throw new Error('Invalid Event viewport');
  }
}

import { supabase } from '@/lib/supabase';
import type { EventDetails } from '@/types/event';
import type { PlaceViewport } from '@/types/familyFriendlyPlace';
import { mapEventDetails, type EventOccurrenceRow, type EventRow } from '@/utils/eventMapping';

export const EVENT_COLUMNS = 'id,title,description,category,image_url,age_min_months,age_max_months,price_note,registration_required,registration_url,verification_status,publication_status,event_status,cancellation_reason,provider,provider_event_id,provider_transport_id,source_group_id,source_name,source_url,source_published_at,source_updated_at,provider_metadata,is_recurring,recurrence_rule,recurrence_timezone,recurrence_series_id,place_id,location_name,formatted_address,latitude,longitude,created_at,updated_at';
export const EVENT_OCCURRENCE_COLUMNS = 'id,event_id,provider_occurrence_id,occurrence_fingerprint,starts_at,ends_at,original_starts_at,occurrence_status,cancellation_reason,source_updated_at,provider_metadata';

const DISCOVERY_EVENT_LIMIT = 200;
const DISCOVERY_HORIZON_DAYS = 90;

export async function queryDiscoveryEvents(viewport: PlaceViewport, now = new Date()): Promise<EventDetails[]> {
  validateViewport(viewport);
  const { data: eventData, error: eventError } = await supabase
    .from('events')
    .select(EVENT_COLUMNS)
    .eq('publication_status', 'published')
    .eq('verification_status', 'verified')
    .gte('latitude', viewport.south)
    .lte('latitude', viewport.north)
    .gte('longitude', viewport.west)
    .lte('longitude', viewport.east)
    .limit(DISCOVERY_EVENT_LIMIT);
  if (eventError) throw new Error(eventError.message);
  const eventRows = (eventData ?? []) as unknown as EventRow[];
  return loadOccurrences(eventRows, now, DISCOVERY_HORIZON_DAYS);
}

export async function queryEventsAtPlace(placeId: string, now = new Date()): Promise<EventDetails[]> {
  if (!placeId.trim()) return [];
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_COLUMNS)
    .eq('place_id', placeId)
    .eq('publication_status', 'published')
    .eq('verification_status', 'verified')
    .limit(DISCOVERY_EVENT_LIMIT);
  if (error) throw new Error(error.message);
  return loadOccurrences((data ?? []) as unknown as EventRow[], now, DISCOVERY_HORIZON_DAYS);
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

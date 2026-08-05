export interface EventOccurrenceIdentityInput {
  provider: string;
  providerEventId: string;
  startsAt: string;
}

export function createEventOccurrenceId(input: EventOccurrenceIdentityInput): string {
  const provider = normalizeIdentifier(input.provider, 'provider');
  const providerEventId = normalizeIdentifier(input.providerEventId, 'providerEventId');
  const startsAt = normalizeTimestamp(input.startsAt);
  return `event-occ-v1-${fnv1a64(`${provider}|${providerEventId}|${startsAt}`)}`;
}

export function createEventOccurrenceFingerprint(input: {
  title: string;
  startsAt: string;
  locationName: string | null;
  latitude: number;
  longitude: number;
}): string {
  if (!isCoordinate(input.latitude, input.longitude)) throw new Error('Invalid event coordinates');
  const identity = [
    normalizeText(input.title),
    normalizeTimestamp(input.startsAt),
    normalizeText(input.locationName ?? ''),
    input.latitude.toFixed(4),
    input.longitude.toFixed(4),
  ].join('|');
  return `event-fp-v1-${fnv1a64(identity)}`;
}

function normalizeIdentifier(value: string, field: string): string {
  const normalized = value.trim().toLocaleLowerCase('en');
  if (!normalized) throw new Error(`Missing event ${field}`);
  return normalized;
}

function normalizeTimestamp(value: string): string {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new Error('Invalid event startsAt');
  return new Date(time).toISOString();
}

function normalizeText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('he').replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/gu, ' ').trim();
}

function isCoordinate(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const character of new TextEncoder().encode(value)) {
    hash ^= BigInt(character);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

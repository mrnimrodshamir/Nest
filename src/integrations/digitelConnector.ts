export const DIGITEL_LAYER_URL = 'https://gisn.tel-aviv.gov.il/arcgis/rest/services/IView2/MapServer/410';
export const DIGITEL_QUERY_URL = `${DIGITEL_LAYER_URL}/query`;
export const DIGITEL_OUT_FIELDS = [
  'OBJECTID', 'title', 'startdate', 'location', 'type', 'NbrId', 'description', 'summary',
  'image_url', 'icon_url', 'sitemapurl', 'modified', 'publishdate', 'lat', 'lon',
] as const;

export const DIGITEL_NOTICE_TYPE = 'הודעות בתוקף';
export const DEFAULT_DIGITEL_PAGE_SIZE = 500;
export const MAX_DIGITEL_PAGE_SIZE = 2_000;
export const DEFAULT_HISTORY_DAYS = 30;

export interface ArcGisFeature {
  attributes?: Record<string, unknown> | null;
  geometry?: { x?: unknown; y?: unknown } | null;
}

export interface ArcGisFeatureResponse {
  features?: ArcGisFeature[];
  exceededTransferLimit?: boolean;
  error?: { code?: number; message?: string; details?: string[] };
}

export interface DigitelSourceRecord {
  objectId: number | null;
  title: string | null;
  startDate: unknown;
  location: string | null;
  type: string | null;
  sourceGroupId: string | null;
  description: string | null;
  summary: string | null;
  imageUrl: string | null;
  iconUrl: string | null;
  sourceUrl: string | null;
  modified: unknown;
  publishDate: unknown;
  latitude: number | null;
  longitude: number | null;
}

export type DigitelExclusionReason =
  | 'notice'
  | 'invalid_or_implausible_start_date'
  | 'outside_history_window'
  | 'missing_transport_id'
  | 'missing_title'
  | 'invalid_coordinates'
  | 'outside_tel_aviv_bounds';

export interface DigitelEventCandidate {
  provider: 'tel_aviv_digitel';
  providerEventId: string;
  providerTransportId: string;
  sourceGroupId: string | null;
  title: string;
  description: string | null;
  sourceType: string | null;
  sourceUrl: string | null;
  startTime: string;
  endTime: null;
  recurring: null;
  ageMinMonths: null;
  ageMaxMonths: null;
  category: null;
  locationName: string | null;
  latitude: number;
  longitude: number;
  price: null;
  registrationRequired: null;
  registrationUrl: null;
  imageUrl: string | null;
  iconUrl: string | null;
  cancellationStatus: null;
  sourcePublishedAt: string | null;
  sourceUpdatedAt: string | null;
  occurrenceFingerprint: string;
  occurrenceIdentityKey: string;
}

export interface ExcludedDigitelRecord {
  objectId: number | null;
  title: string | null;
  reasons: DigitelExclusionReason[];
}

export interface DigitelNormalizationResult {
  candidates: DigitelEventCandidate[];
  excluded: ExcludedDigitelRecord[];
}

export interface FetchDigitelOptions {
  pageSize?: number;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  maxPages?: number;
}

export interface FetchDigitelResult {
  features: ArcGisFeature[];
  pages: number;
  requestUrls: string[];
}

export interface NormalizeDigitelOptions {
  now?: Date;
  historyDays?: number;
  bounds?: { north: number; south: number; east: number; west: number };
}

const DEFAULT_TEL_AVIV_BOUNDS = { south: 31.95, north: 32.15, west: 34.72, east: 34.86 };
const MIN_PLAUSIBLE_DATE = Date.UTC(2000, 0, 1);
const MAX_FUTURE_YEARS = 5;

export async function fetchAllDigitelFeatures(options: FetchDigitelOptions = {}): Promise<FetchDigitelResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const pageSize = clampPageSize(options.pageSize);
  const maxPages = Math.max(1, Math.floor(options.maxPages ?? 100));
  const features: ArcGisFeature[] = [];
  const requestUrls: string[] = [];
  const seenObjectIds = new Set<number>();
  let offset = 0;

  for (let page = 0; page < maxPages; page += 1) {
    const requestUrl = buildDigitelQueryUrl(offset, pageSize);
    requestUrls.push(requestUrl);
    const response = await fetchImpl(requestUrl, { signal: options.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`DigiTel ArcGIS request failed with HTTP ${response.status}`);
    const body = (await response.json()) as ArcGisFeatureResponse;
    if (body.error) throw new Error(`DigiTel ArcGIS error ${body.error.code ?? 'unknown'}: ${body.error.message ?? 'Unknown error'}`);
    if (!Array.isArray(body.features)) throw new Error('DigiTel ArcGIS returned a malformed feature response');

    let newTransportIds = 0;
    for (const feature of body.features) {
      const objectId = asInteger(feature.attributes?.OBJECTID);
      if (objectId != null) {
        if (seenObjectIds.has(objectId)) continue;
        seenObjectIds.add(objectId);
        newTransportIds += 1;
      }
      features.push(feature);
    }

    if (body.features.length > 0 && newTransportIds === 0) {
      throw new Error('DigiTel ArcGIS pagination made no progress; the source repeated a stale page');
    }
    if (!body.exceededTransferLimit && body.features.length < pageSize) {
      return { features, pages: page + 1, requestUrls };
    }
    if (body.features.length === 0) {
      throw new Error('DigiTel ArcGIS reported more data but returned an empty page');
    }
    offset += body.features.length;
  }

  throw new Error(`DigiTel ArcGIS exceeded the ${maxPages}-page safety limit`);
}

export function buildDigitelQueryUrl(offset: number, pageSize = DEFAULT_DIGITEL_PAGE_SIZE): string {
  const params = new URLSearchParams({
    where: '1=1',
    f: 'json',
    returnGeometry: 'true',
    outSR: '4326',
    outFields: DIGITEL_OUT_FIELDS.join(','),
    resultRecordCount: String(clampPageSize(pageSize)),
    resultOffset: String(Math.max(0, Math.floor(offset))),
    orderByFields: 'modified ASC, OBJECTID ASC',
  });
  return `${DIGITEL_QUERY_URL}?${params.toString()}`;
}

export function normalizeDigitelFeatures(
  features: readonly ArcGisFeature[],
  options: NormalizeDigitelOptions = {},
): DigitelNormalizationResult {
  const now = options.now ?? new Date();
  const historyDays = Math.max(0, options.historyDays ?? DEFAULT_HISTORY_DAYS);
  const historyFloor = now.getTime() - historyDays * 24 * 60 * 60 * 1_000;
  const bounds = options.bounds ?? DEFAULT_TEL_AVIV_BOUNDS;
  const candidates: DigitelEventCandidate[] = [];
  const excluded: ExcludedDigitelRecord[] = [];

  for (const feature of features) {
    const source = mapSourceRecord(feature);
    const title = normalizeDigitelText(source.title);
    const locationName = normalizeDigitelText(source.location);
    const sourceType = normalizeDigitelText(source.type);
    const startTime = normalizeArcGisDate(source.startDate, now);
    const reasons: DigitelExclusionReason[] = [];

    if (sourceType === DIGITEL_NOTICE_TYPE) reasons.push('notice');
    if (!startTime) reasons.push('invalid_or_implausible_start_date');
    else if (new Date(startTime).getTime() < historyFloor) reasons.push('outside_history_window');
    if (source.objectId == null) reasons.push('missing_transport_id');
    if (!title) reasons.push('missing_title');
    if (!isCoordinate(source.latitude, source.longitude)) reasons.push('invalid_coordinates');
    else if (!isInsideBounds(source.latitude!, source.longitude!, bounds)) reasons.push('outside_tel_aviv_bounds');

    if (reasons.length > 0 || !title || !startTime || !isCoordinate(source.latitude, source.longitude) || source.objectId == null) {
      excluded.push({ objectId: source.objectId, title, reasons });
      continue;
    }

    const description = normalizeDigitelText(source.description) ?? normalizeDigitelText(source.summary);
    const identityKey = buildOccurrenceIdentityKey({
      title,
      startTime,
      locationName,
      latitude: source.latitude!,
      longitude: source.longitude!,
    });
    const fingerprint = `digitel-v1-${fnv1a64(identityKey)}`;
    candidates.push({
      provider: 'tel_aviv_digitel',
      providerEventId: fingerprint,
      providerTransportId: String(source.objectId),
      sourceGroupId: source.sourceGroupId,
      title,
      description,
      sourceType,
      sourceUrl: normalizeHttpsUrl(source.sourceUrl),
      startTime,
      endTime: null,
      recurring: null,
      ageMinMonths: null,
      ageMaxMonths: null,
      category: null,
      locationName,
      latitude: source.latitude!,
      longitude: source.longitude!,
      price: null,
      registrationRequired: null,
      registrationUrl: null,
      imageUrl: normalizeHttpsUrl(source.imageUrl),
      iconUrl: normalizeHttpsUrl(source.iconUrl),
      cancellationStatus: null,
      sourcePublishedAt: normalizeArcGisDate(source.publishDate, now),
      sourceUpdatedAt: normalizeArcGisDate(source.modified, now),
      occurrenceFingerprint: fingerprint,
      occurrenceIdentityKey: identityKey,
    });
  }

  return { candidates, excluded };
}

export function mapSourceRecord(feature: ArcGisFeature): DigitelSourceRecord {
  const attributes = feature.attributes ?? {};
  const geometryLatitude = asFiniteNumber(feature.geometry?.y);
  const geometryLongitude = asFiniteNumber(feature.geometry?.x);
  return {
    objectId: asInteger(attributes.OBJECTID),
    title: asNullableString(attributes.title),
    startDate: attributes.startdate,
    location: asNullableString(attributes.location),
    type: asNullableString(attributes.type),
    sourceGroupId: attributes.NbrId == null ? null : String(attributes.NbrId),
    description: asNullableString(attributes.description),
    summary: asNullableString(attributes.summary),
    imageUrl: asNullableString(attributes.image_url),
    iconUrl: asNullableString(attributes.icon_url),
    sourceUrl: asNullableString(attributes.sitemapurl),
    modified: attributes.modified,
    publishDate: attributes.publishdate,
    latitude: geometryLatitude ?? asFiniteNumber(attributes.lat),
    longitude: geometryLongitude ?? asFiniteNumber(attributes.lon),
  };
}

export function normalizeDigitelText(value: string | null | undefined): string | null {
  if (!value) return null;
  const decoded = decodeHtmlEntities(value.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ' '));
  const normalized = decoded.replace(/[\u00a0\u200e\u200f]/g, ' ').replace(/\s+/gu, ' ').trim();
  return normalized || null;
}

export function normalizeArcGisDate(value: unknown, now = new Date()): string | null {
  const timestamp = asFiniteNumber(value);
  if (timestamp == null) return null;
  const max = Date.UTC(now.getUTCFullYear() + MAX_FUTURE_YEARS, 11, 31, 23, 59, 59, 999);
  if (timestamp < MIN_PLAUSIBLE_DATE || timestamp > max) return null;
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function buildOccurrenceIdentityKey(input: {
  title: string;
  startTime: string;
  locationName: string | null;
  latitude: number;
  longitude: number;
}): string {
  return [
    normalizeIdentityText(input.title),
    new Date(input.startTime).toISOString(),
    normalizeIdentityText(input.locationName ?? ''),
    input.latitude.toFixed(4),
    input.longitude.toFixed(4),
  ].join('|');
}

export function groupFingerprintCollisions(candidates: readonly DigitelEventCandidate[]): DigitelEventCandidate[][] {
  const groups = new Map<string, DigitelEventCandidate[]>();
  for (const candidate of candidates) {
    const group = groups.get(candidate.occurrenceFingerprint) ?? [];
    group.push(candidate);
    groups.set(candidate.occurrenceFingerprint, group);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}

function normalizeIdentityText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('he').replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/gu, ' ').trim();
}

function normalizeHttpsUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCodePoint(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_, digits: string) => String.fromCodePoint(Number.parseInt(digits, 16)));
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const character of new TextEncoder().encode(value)) {
    hash ^= BigInt(character);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

function clampPageSize(value: number | undefined): number {
  return Math.max(1, Math.min(MAX_DIGITEL_PAGE_SIZE, Math.floor(value ?? DEFAULT_DIGITEL_PAGE_SIZE)));
}

function asFiniteNumber(value: unknown): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

function asInteger(value: unknown): number | null {
  const number = asFiniteNumber(value);
  return number != null && Number.isInteger(number) ? number : null;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function isCoordinate(latitude: number | null, longitude: number | null): boolean {
  return latitude != null && longitude != null && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

function isInsideBounds(
  latitude: number,
  longitude: number,
  bounds: { north: number; south: number; east: number; west: number },
): boolean {
  return latitude >= bounds.south && latitude <= bounds.north && longitude >= bounds.west && longitude <= bounds.east;
}

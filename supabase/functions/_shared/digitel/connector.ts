export const DIGITEL_LAYER_URL = 'https://gisn.tel-aviv.gov.il/arcgis/rest/services/IView2/MapServer/410';
export const DIGITEL_QUERY_URL = `${DIGITEL_LAYER_URL}/query`;
export const DIGITEL_METADATA_URL = `${DIGITEL_LAYER_URL}?f=json`;
export const DIGITEL_OUT_FIELDS = [
  'OBJECTID', 'title', 'startdate', 'location', 'type', 'NbrId', 'description', 'summary',
  'image_url', 'icon_url', 'sitemapurl', 'modified', 'publishdate', 'lat', 'lon',
] as const;

export const DIGITEL_NOTICE_TYPE = 'הודעות בתוקף';
export const DEFAULT_DIGITEL_PAGE_SIZE = 500;
export const MAX_DIGITEL_PAGE_SIZE = 2_000;
export const DEFAULT_HISTORY_DAYS = 30;
export const DEFAULT_DIGITEL_TIMEOUT_MS = 10_000;
export const DEFAULT_DIGITEL_MAX_ATTEMPTS = 3;
export const DEFAULT_DIGITEL_RETRY_BASE_DELAY_MS = 250;

export interface ArcGisFeature {
  attributes?: Record<string, unknown> | null;
  geometry?: { x?: unknown; y?: unknown } | null;
}

export interface ArcGisFeatureResponse {
  features?: ArcGisFeature[];
  exceededTransferLimit?: boolean;
  error?: { code?: number; message?: string; details?: string[] };
}

export interface ArcGisLayerMetadata {
  id?: unknown;
  name?: unknown;
  type?: unknown;
  geometryType?: unknown;
  maxRecordCount?: unknown;
  capabilities?: unknown;
  fields?: Array<{ name?: unknown; type?: unknown }>;
  error?: { code?: number; message?: string; details?: string[] };
}

export interface DigitelSourceValidation {
  valid: boolean;
  layerId: number | null;
  layerName: string | null;
  geometryType: string | null;
  maxRecordCount: number | null;
  supportsQuery: boolean;
  missingFields: string[];
  errors: string[];
  warnings: string[];
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
  timeoutMs?: number;
  maxAttempts?: number;
  retryBaseDelayMs?: number;
  sleepImpl?: (milliseconds: number) => Promise<void>;
}

export interface FetchDigitelResult {
  features: ArcGisFeature[];
  pages: number;
  requestUrls: string[];
  requestAttempts: number;
  retryCount: number;
}

export interface FetchDigitelMetadataResult {
  metadata: ArcGisLayerMetadata;
  validation: DigitelSourceValidation;
  requestAttempts: number;
  retryCount: number;
}

export type DigitelConnectorErrorCode =
  | 'TIMEOUT'
  | 'SOURCE_UNAVAILABLE'
  | 'HTTP_ERROR'
  | 'ARCGIS_ERROR'
  | 'MALFORMED_RESPONSE'
  | 'PAGINATION_STALE'
  | 'PAGE_LIMIT';

export class DigitelConnectorError extends Error {
  readonly code: DigitelConnectorErrorCode;
  readonly status: number | null;

  constructor(code: DigitelConnectorErrorCode, message: string, status: number | null = null) {
    super(message);
    this.name = 'DigitelConnectorError';
    this.code = code;
    this.status = status;
  }
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
  let requestAttempts = 0;
  let retryCount = 0;

  for (let page = 0; page < maxPages; page += 1) {
    const requestUrl = buildDigitelQueryUrl(offset, pageSize);
    requestUrls.push(requestUrl);
    const requested = await requestArcGisJson<ArcGisFeatureResponse>(requestUrl, options, fetchImpl);
    requestAttempts += requested.attempts;
    retryCount += requested.attempts - 1;
    const body = requested.body;
    if (!Array.isArray(body.features)) throw new DigitelConnectorError('MALFORMED_RESPONSE', 'DigiTel ArcGIS returned a malformed feature response');

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
      throw new DigitelConnectorError('PAGINATION_STALE', 'DigiTel ArcGIS pagination made no progress; the source repeated a stale page');
    }
    if (!body.exceededTransferLimit && body.features.length < pageSize) {
      return { features, pages: page + 1, requestUrls, requestAttempts, retryCount };
    }
    if (body.features.length === 0) {
      throw new DigitelConnectorError('PAGINATION_STALE', 'DigiTel ArcGIS reported more data but returned an empty page');
    }
    offset += body.features.length;
  }

  throw new DigitelConnectorError('PAGE_LIMIT', `DigiTel ArcGIS exceeded the ${maxPages}-page safety limit`);
}

export async function fetchAndValidateDigitelSource(options: FetchDigitelOptions = {}): Promise<FetchDigitelMetadataResult> {
  const requested = await requestArcGisJson<ArcGisLayerMetadata>(DIGITEL_METADATA_URL, options, options.fetchImpl ?? fetch);
  return {
    metadata: requested.body,
    validation: validateDigitelSourceMetadata(requested.body),
    requestAttempts: requested.attempts,
    retryCount: requested.attempts - 1,
  };
}

export function validateDigitelSourceMetadata(metadata: ArcGisLayerMetadata): DigitelSourceValidation {
  const layerId = asInteger(metadata.id);
  const layerName = asNullableString(metadata.name)?.trim() || null;
  const geometryType = asNullableString(metadata.geometryType)?.trim() || null;
  const maxRecordCount = asInteger(metadata.maxRecordCount);
  const capabilities = asNullableString(metadata.capabilities) ?? '';
  const sourceFields = new Set((metadata.fields ?? []).flatMap((field) => typeof field.name === 'string' ? [field.name] : []));
  const missingFields = DIGITEL_OUT_FIELDS.filter((field) => !sourceFields.has(field));
  const errors: string[] = [];
  const warnings: string[] = [];
  if (layerId !== 410) errors.push('unexpected_layer_id');
  if (geometryType !== 'esriGeometryPoint') errors.push('unexpected_geometry_type');
  if (!capabilities.split(',').map((value) => value.trim().toLocaleLowerCase('en')).includes('query')) errors.push('query_not_supported');
  if (missingFields.length > 0) errors.push('required_fields_missing');
  if (maxRecordCount == null || maxRecordCount < 1) errors.push('invalid_max_record_count');
  if (layerName !== 'אירועים דיגיתל') warnings.push('unexpected_layer_name');
  return {
    valid: errors.length === 0,
    layerId,
    layerName,
    geometryType,
    maxRecordCount,
    supportsQuery: !errors.includes('query_not_supported'),
    missingFields,
    errors,
    warnings,
  };
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

async function requestArcGisJson<T extends { error?: { code?: number; message?: string } }>(
  url: string,
  options: FetchDigitelOptions,
  fetchImpl: typeof fetch,
): Promise<{ body: T; attempts: number }> {
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? DEFAULT_DIGITEL_MAX_ATTEMPTS));
  const timeoutMs = Math.max(1, Math.floor(options.timeoutMs ?? DEFAULT_DIGITEL_TIMEOUT_MS));
  const retryBaseDelayMs = Math.max(0, Math.floor(options.retryBaseDelayMs ?? DEFAULT_DIGITEL_RETRY_BASE_DELAY_MS));
  const sleepImpl = options.sleepImpl ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  let lastError: DigitelConnectorError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (options.signal?.aborted) throw options.signal.reason ?? new DOMException('Aborted', 'AbortError');
    const controller = new AbortController();
    let timedOut = false;
    const abortFromParent = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener('abort', abortFromParent, { once: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort(new DOMException('Timed out', 'TimeoutError'));
    }, timeoutMs);

    try {
      const response = await fetchImpl(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) {
        const error = new DigitelConnectorError('HTTP_ERROR', `DigiTel ArcGIS request failed with HTTP ${response.status}`, response.status);
        if (!isRetryableStatus(response.status) || attempt === maxAttempts) throw error;
        lastError = error;
      } else {
        let body: T;
        try { body = await response.json() as T; } catch { throw new DigitelConnectorError('MALFORMED_RESPONSE', 'DigiTel ArcGIS returned invalid JSON'); }
        if (body.error) {
          const status = typeof body.error.code === 'number' ? body.error.code : null;
          const error = new DigitelConnectorError('ARCGIS_ERROR', `DigiTel ArcGIS error ${status ?? 'unknown'}: ${body.error.message ?? 'Unknown error'}`, status);
          if (status == null || !isRetryableStatus(status) || attempt === maxAttempts) throw error;
          lastError = error;
        } else {
          return { body, attempts: attempt };
        }
      }
    } catch (error) {
      if (options.signal?.aborted) throw options.signal.reason ?? error;
      const normalized = error instanceof DigitelConnectorError
        ? error
        : timedOut
          ? new DigitelConnectorError('TIMEOUT', `DigiTel ArcGIS timed out after ${timeoutMs}ms`)
          : new DigitelConnectorError('SOURCE_UNAVAILABLE', 'DigiTel ArcGIS is temporarily unavailable');
      if (normalized.code === 'MALFORMED_RESPONSE' || (normalized.code === 'HTTP_ERROR' && normalized.status != null && !isRetryableStatus(normalized.status)) || (normalized.code === 'ARCGIS_ERROR' && normalized.status != null && !isRetryableStatus(normalized.status)) || attempt === maxAttempts) {
        throw normalized;
      }
      lastError = normalized;
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abortFromParent);
    }

    if (attempt < maxAttempts) await sleepImpl(retryBaseDelayMs * 2 ** (attempt - 1));
  }

  throw lastError ?? new DigitelConnectorError('SOURCE_UNAVAILABLE', 'DigiTel ArcGIS is temporarily unavailable');
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

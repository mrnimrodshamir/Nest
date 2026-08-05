import type { DigitelEventCandidate } from '@/integrations/digitelConnector';
import type { EventCategory } from '@/types/event';
import { createEventOccurrenceId } from '@/utils/eventIdentity';

export type ActivationDecision = 'PASS' | 'REVIEW' | 'FAIL';

export interface ExistingPlaceLink {
  id: string;
  sourceLocation: string;
  matchReason: 'exact_known_mapping';
}

export interface CuratedActivationRow {
  decision: ActivationDecision;
  reason: string;
  providerTransportId: string | null;
  title: string;
  startsAt: string | null;
  occurrenceFingerprint: string | null;
  placeId: string | null;
}

export interface ActivationEvent {
  provider: 'tel_aviv_digitel';
  providerEventId: string;
  providerTransportId: string;
  sourceGroupId: string | null;
  occurrenceId: string;
  occurrenceFingerprint: string;
  title: string;
  description: string | null;
  category: EventCategory;
  startsAt: string;
  endsAt: null;
  timezone: 'Asia/Jerusalem';
  placeId: string | null;
  locationName: string;
  formattedAddress: null;
  latitude: number;
  longitude: number;
  sourceName: 'Tel Aviv DigiTel';
  sourceUrl: string;
  sourcePublishedAt: string | null;
  sourceUpdatedAt: string | null;
  verificationStatus: 'verified';
  publicationStatus: 'published';
  status: 'scheduled';
  isVisible: true;
  imageUrl: null;
  ageMinMonths: null;
  ageMaxMonths: null;
  priceNote: null;
  registrationRequired: null;
  registrationUrl: null;
  isRecurring: false;
}

/** Manually reviewed source records for the first deliberately small release. */
export const SPRINT9_PASS_TRANSPORT_IDS = new Set([
  '8199', '8224', '8613', '8395', '8885', '8927', '8974', '8394', '8009', '8962',
  '8010', '8468', '8708', '8574', '9147', '8278', '8314', '8707', '8088', '8572',
  '9025', '8884', '8338', '8860', '9063', '9213', '8312', '9045', '9135', '8567',
]);

const PLACE_LINKS_BY_LOCATION: Record<string, string> = {
  'חריף אייזיק 23': 'dcf017cf-9ca7-4d54-b453-a27809ab6ea7',
  'ולנברג ראול 43': '79f03710-7251-45c6-91fd-0b4ee47cd087',
  'מתחם ליפקין שחק- שטח הנמל 15': 'e080594d-504e-4b25-89f3-ac842944ed03',
  'שדרות נורדאו 63': '6732016f-73db-42ab-9551-e4405822a686',
  'שדרות ששת הימים 6': '2896989a-1a54-4c50-9287-2239406c4dc9',
  'קיציס יוסף 23': 'a17a10a8-e794-415c-896e-34773ae26a44',
  'שדרות שאול המלך 25': '16e21a42-8edc-45fb-8c40-bdc109312a34',
  'טאגור רבינדרנת 26': 'fe732b98-c49f-4aea-8655-015e206978cb',
  'דרזנר יחיאל 2': 'a3b4341a-c9d7-47be-9717-8b0efc188cbb',
};

const ADULT_ONLY = ['גמלאים', 'אזרחים ותיקים', 'למבוגרים בלבד', '18+'];
const CANCELLED = ['*בוטל*', '*מבוטל*', 'בוטל -', 'מבוטל -'];

export function curateDigitelActivation(candidates: DigitelEventCandidate[], now: Date): { rows: CuratedActivationRow[]; pass: ActivationEvent[] } {
  const duplicateFingerprints = duplicates(candidates.map((candidate) => candidate.occurrenceFingerprint));
  const rows: CuratedActivationRow[] = [];
  const pass: ActivationEvent[] = [];
  for (const candidate of candidates) {
    const result = classify(candidate, now, duplicateFingerprints);
    rows.push(result.row);
    if (result.event) pass.push(result.event);
  }
  assertActivationBatch(pass);
  return { rows, pass: pass.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.occurrenceId.localeCompare(b.occurrenceId)) };
}

function classify(candidate: DigitelEventCandidate, now: Date, duplicateFingerprints: Set<string>): { row: CuratedActivationRow; event: ActivationEvent | null } {
  const base = { providerTransportId: candidate.providerTransportId, title: candidate.title, startsAt: candidate.startTime, occurrenceFingerprint: candidate.occurrenceFingerprint };
  const fail = (reason: string): { row: CuratedActivationRow; event: null } => ({ row: { decision: 'FAIL', reason, placeId: null, ...base }, event: null });
  const review = (reason: string): { row: CuratedActivationRow; event: null } => ({ row: { decision: 'REVIEW', reason, placeId: null, ...base }, event: null });
  if (!candidate.providerTransportId || !candidate.title.trim()) return fail('missing_identity_or_title');
  if (!Number.isFinite(Date.parse(candidate.startTime))) return fail('invalid_start_time');
  if (Date.parse(candidate.startTime) <= now.getTime()) return fail('not_future');
  if (!validCoordinate(candidate.latitude, candidate.longitude)) return fail('invalid_coordinates');
  if (!isHttps(candidate.sourceUrl)) return fail('missing_or_invalid_source_url');
  if (duplicateFingerprints.has(candidate.occurrenceFingerprint)) return fail('duplicate_fingerprint_conflict');
  const text = `${candidate.title} ${candidate.description ?? ''}`;
  if (CANCELLED.some((term) => text.includes(term))) return fail('unsupported_cancellation_claim');
  if (ADULT_ONLY.some((term) => text.includes(term))) return fail('adult_only_or_senior_programming');
  if (!SPRINT9_PASS_TRANSPORT_IDS.has(candidate.providerTransportId)) return review('not_in_manually_approved_first_batch');
  const placeId = candidate.locationName ? PLACE_LINKS_BY_LOCATION[candidate.locationName] ?? null : null;
  const event = toActivationEvent(candidate, placeId);
  return { row: { decision: 'PASS', reason: 'manually_verified_family_event', placeId, ...base }, event };
}

function toActivationEvent(candidate: DigitelEventCandidate, placeId: string | null): ActivationEvent {
  return {
    provider: 'tel_aviv_digitel', providerEventId: candidate.occurrenceFingerprint,
    providerTransportId: candidate.providerTransportId!, sourceGroupId: candidate.sourceGroupId,
    occurrenceId: createEventOccurrenceId({ provider: 'tel_aviv_digitel', providerEventId: candidate.occurrenceFingerprint, startsAt: candidate.startTime }),
    occurrenceFingerprint: candidate.occurrenceFingerprint, title: candidate.title.trim(), description: candidate.description?.trim() || null,
    category: classifyCategory(`${candidate.title} ${candidate.description ?? ''}`), startsAt: candidate.startTime, endsAt: null,
    timezone: 'Asia/Jerusalem', placeId, locationName: candidate.locationName?.trim() || 'Tel Aviv-Yafo', formattedAddress: null,
    latitude: candidate.latitude, longitude: candidate.longitude, sourceName: 'Tel Aviv DigiTel', sourceUrl: candidate.sourceUrl!,
    sourcePublishedAt: candidate.sourcePublishedAt, sourceUpdatedAt: candidate.sourceUpdatedAt,
    verificationStatus: 'verified', publicationStatus: 'published', status: 'scheduled', isVisible: true,
    imageUrl: null, ageMinMonths: null, ageMaxMonths: null, priceNote: null, registrationRequired: null,
    registrationUrl: null, isRecurring: false,
  };
}

export function classifyCategory(text: string): EventCategory {
  if (/שעת סיפור|סיפור|ספרים/u.test(text)) return 'story_time';
  if (/סדנ|יצירה|קומיקס|פלסטלינה|בובנאות|שיקויים|מטבח/u.test(text)) return 'workshop';
  if (/הצג|תאטרון|תיאטרון|מופע|סרט|קרקס/u.test(text)) return 'performance';
  if (/יוגה|ספורט|שחייה|כדור|סייף/u.test(text)) return 'sports';
  if (/מוזיאון|ארכיאולוג/u.test(text)) return 'museum';
  if (/טבע|פארק|גינה/u.test(text)) return 'park';
  return 'community';
}

export function assertActivationBatch(events: ActivationEvent[]): void {
  if (events.length < 20 || events.length > 50) throw new Error(`Activation batch must contain 20-50 Events; received ${events.length}`);
  const identities = events.map((event) => `${event.provider}|${event.providerEventId}`);
  const fingerprints = events.map((event) => event.occurrenceFingerprint);
  const occurrenceIds = events.map((event) => event.occurrenceId);
  if (duplicates(identities).size) throw new Error('Duplicate provider identity in activation batch');
  if (duplicates(fingerprints).size) throw new Error('Duplicate occurrence fingerprint in activation batch');
  if (duplicates(occurrenceIds).size) throw new Error('Duplicate occurrence ID in activation batch');
  for (const event of events) {
    if (!validCoordinate(event.latitude, event.longitude)) throw new Error(`Invalid coordinates for ${event.providerTransportId}`);
    if (!isHttps(event.sourceUrl)) throw new Error(`Invalid source URL for ${event.providerTransportId}`);
    if (event.imageUrl !== null) throw new Error('Unapproved image URL cannot be published');
    if (event.verificationStatus !== 'verified' || event.publicationStatus !== 'published') throw new Error('Only verified Events may be published');
  }
}

function duplicates(values: string[]): Set<string> {
  const seen = new Set<string>(); const duplicate = new Set<string>();
  for (const value of values) seen.has(value) ? duplicate.add(value) : seen.add(value);
  return duplicate;
}

function validCoordinate(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && latitude >= 31.95 && latitude <= 32.16 && Number.isFinite(longitude) && longitude >= 34.70 && longitude <= 34.90;
}

function isHttps(value: string | null): value is string {
  if (!value) return false;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

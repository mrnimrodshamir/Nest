import type { BeitEmanuelRawRecord } from './connector.ts';
import type { ProviderCandidate } from '../providers/types.ts';
import { parseHebrewAgeRange } from '../providers/ageParsing.ts';
import { classifyDigitelCategory } from '../digitel/eventMapping.ts';
import { fnv1a64 } from '../providers/fingerprint.ts';

export const BEIT_EMANUEL_PROVIDER_KEY = 'ramat_gan_beit_emanuel';
export const BEIT_EMANUEL_SOURCE_NAME = 'בית עמנואל רמת גן';
export const BEIT_EMANUEL_PROVIDER_URL = 'https://mbe-rg.smarticket.co.il/';

const VENUES = [
  { aliases: ['משחקיית ר"געים','משחקיית ר״געים','ר"געים משחקייה','ר״געים משחקייה'], name: 'משחקיית ר״געים', address: 'ביאליק 89, רמת גן', latitude: 32.0849863, longitude: 34.8122928 },
  { aliases: ['בית הצנחן'], name: 'בית הצנחן', address: 'רוקח 121, רמת גן', latitude: 32.0969629, longitude: 34.8165514 },
  { aliases: ['בית דורון'], name: 'בית דורון', address: 'הראשונים 1, רמת גן', latitude: 32.082076, longitude: 34.80393 },
] as const;

export type BeitEmanuelExclusion = 'missing_title' | 'online_only' | 'coordinates_unresolved' | 'outside_ramat_gan';

export function mapBeitEmanuelRecord(raw: BeitEmanuelRawRecord): { candidate: ProviderCandidate | null; excludedReason: BeitEmanuelExclusion | null } {
  if (!raw.title.trim()) return { candidate: null, excludedReason: 'missing_title' };
  const haystack = `${raw.venue} ${raw.address ?? ''}`;
  if (/זום|zoom|online|מקוון/i.test(haystack)) return { candidate: null, excludedReason: 'online_only' };
  const venue = VENUES.find((entry) => entry.aliases.some((alias) => haystack.includes(alias)));
  if (!venue) return { candidate: null, excludedReason: 'coordinates_unresolved' };
  const ageText = `${raw.title} ${raw.description ?? ''}`;
  const age = parseBeitEmanuelAge(ageText) ?? parseHebrewAgeRange(ageText);
  const fingerprint = `beit-emanuel-v1-${fnv1a64(`${raw.id}|${raw.startsAt}`)}`;
  return { excludedReason: null, candidate: {
    providerEventId: raw.id, providerTransportId: raw.id, sourceGroupId: null,
    title: raw.title, description: raw.description, category: classifyDigitelCategory(`${raw.title} ${raw.description ?? ''}`),
    sourceType: 'external_organizer', sourceUrl: raw.sourceUrl, startTime: raw.startsAt, endTime: raw.endsAt,
    locationName: venue.name, formattedAddress: venue.address, latitude: venue.latitude, longitude: venue.longitude,
    ageMinMonths: age.ageMinMonths, ageMaxMonths: age.ageMaxMonths, priceNote: raw.priceNote,
    registrationRequired: true, registrationUrl: raw.registrationUrl, airConditioned: null, indoorOutdoor: null,
    sourcePublishedAt: null, sourceUpdatedAt: null,
    providerMetadata: { smarticketId: raw.id, cityId: 'ramat_gan', imageRightsCleared: false },
    occurrenceFingerprint: fingerprint,
  }};
}

/** Exact content duplicates can be separate Smarticket sale records. Collapse
 * only when title, occurrence time and curated venue are identical; age-group
 * sessions with different titles remain distinct. */
export function dedupeBeitEmanuelCandidates(candidates: ProviderCandidate[]): { candidates: ProviderCandidate[]; duplicateCount: number } {
  const byContent = new Map<string, ProviderCandidate>();
  for (const candidate of [...candidates].sort((a, b) => a.providerEventId.localeCompare(b.providerEventId))) {
    const key = `${normalize(candidate.title)}|${candidate.startTime}|${normalize(candidate.locationName)}`;
    if (!byContent.has(key)) byContent.set(key, candidate);
  }
  return { candidates: [...byContent.values()], duplicateCount: candidates.length - byContent.size };
}

function parseBeitEmanuelAge(text: string): { ageMinMonths: number; ageMaxMonths: number } | null {
  const normalized = normalize(text);
  if (/לידה עד (?:גיל )?שנה/.test(normalized)) return { ageMinMonths: 0, ageMaxMonths: 12 };
  if (/שנה וחצי עד שלוש/.test(normalized)) return { ageMinMonths: 18, ageMaxMonths: 36 };
  if (/שנה עד שלוש/.test(normalized)) return { ageMinMonths: 12, ageMaxMonths: 36 };
  if (/שנתיים וחצי עד שלוש וחצי/.test(normalized)) return { ageMinMonths: 30, ageMaxMonths: 42 };
  return null;
}

function normalize(value: string): string { return value.normalize('NFKC').replace(/[״“”]/g, '"').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim().toLocaleLowerCase('he'); }

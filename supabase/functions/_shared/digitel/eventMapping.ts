import type { DigitelEventCandidate } from './connector.ts';

export type DigitelEventCategory =
  | 'story_time' | 'workshop' | 'performance' | 'festival' | 'museum'
  | 'library' | 'park' | 'sports' | 'community' | 'animals' | 'other';

export interface DigitelSyncCandidate {
  providerEventId: string;
  providerTransportId: string;
  sourceGroupId: string | null;
  occurrenceId: string;
  occurrenceFingerprint: string;
  title: string;
  description: string | null;
  category: DigitelEventCategory;
  startsAt: string;
  endsAt: string | null;
  locationName: string;
  latitude: number;
  longitude: number;
  sourceUrl: string;
  sourcePublishedAt: string | null;
  sourceUpdatedAt: string | null;
  providerMetadata: Record<string, string | null>;
}

const OFFICIAL_SOURCE_URL = 'https://www.tel-aviv.gov.il/Visitors/Events/Pages/Events.aspx';

export function mapDigitelSyncCandidate(candidate: DigitelEventCandidate): DigitelSyncCandidate {
  return {
    providerEventId: candidate.occurrenceFingerprint,
    providerTransportId: candidate.providerTransportId,
    sourceGroupId: candidate.sourceGroupId,
    occurrenceId: createOccurrenceId(candidate.provider, candidate.occurrenceFingerprint, candidate.startTime),
    occurrenceFingerprint: candidate.occurrenceFingerprint,
    title: candidate.title.trim(),
    description: candidate.description?.trim() || null,
    category: classifyDigitelCategory(`${candidate.title} ${candidate.description ?? ''} ${candidate.sourceType ?? ''}`),
    startsAt: candidate.startTime,
    endsAt: candidate.endTime,
    locationName: candidate.locationName?.trim() || 'Tel Aviv-Yafo',
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    sourceUrl: candidate.sourceUrl ?? OFFICIAL_SOURCE_URL,
    sourcePublishedAt: candidate.sourcePublishedAt,
    sourceUpdatedAt: candidate.sourceUpdatedAt,
    providerMetadata: {
      source_type: candidate.sourceType,
      source_group_id: candidate.sourceGroupId,
      icon_url: candidate.iconUrl,
    },
  };
}

export function classifyDigitelCategory(text: string): DigitelEventCategory {
  const normalized = text.toLocaleLowerCase('he');
  if (/שעת סיפור|סיפור|ספרים|story\s*time/u.test(normalized)) return 'story_time';
  if (/סדנ|יצירה|קומיקס|פלסטלינה|בובנאות|workshop/u.test(normalized)) return 'workshop';
  if (/הצג|תאטרון|תיאטרון|מופע|סרט|קרקס|performance|show/u.test(normalized)) return 'performance';
  if (/פסטיבל|festival/u.test(normalized)) return 'festival';
  if (/מוזיאון|ארכיאולוג|museum/u.test(normalized)) return 'museum';
  if (/ספריה|ספרייה|library/u.test(normalized)) return 'library';
  if (/טבע|פארק|גינה|park/u.test(normalized)) return 'park';
  if (/יוגה|ספורט|שחייה|כדור|סייף|sport/u.test(normalized)) return 'sports';
  if (/חיות|בעלי חיים|גן חיות|animal|zoo/u.test(normalized)) return 'animals';
  return 'community';
}

export function createOccurrenceId(provider: string, providerEventId: string, startsAt: string): string {
  const identity = `${provider.trim().toLocaleLowerCase('en')}|${providerEventId.trim().toLocaleLowerCase('en')}|${new Date(startsAt).toISOString()}`;
  return `event-occ-v1-${fnv1a64(identity)}`;
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const character of new TextEncoder().encode(value)) {
    hash ^= BigInt(character);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

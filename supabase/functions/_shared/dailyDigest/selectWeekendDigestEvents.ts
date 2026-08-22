import {
  DEFAULT_DIGEST_RADIUS_KM,
  TEL_AVIV_CENTER,
  dedupeMirroredDigestCandidates,
  selectDigestEvents,
  type DigestCandidateOccurrence,
} from './selectDigestEvents.ts';
import {
  isStrongWeeklyCandidate,
  selectWeeklyDigestEvents,
} from './selectWeeklyDigestEvents.ts';
import type { WeekendDigestPeriod } from './scheduleGate.ts';

export const DEFAULT_WEEKEND_MAX_PER_SECTION = 3;

export type WeekendSectionKey = 'thursday_evening' | 'friday' | 'saturday';

export interface WeekendDigestSection {
  key: WeekendSectionKey;
  localDate: string;
  events: DigestCandidateOccurrence[];
  eligibleCount: number;
}

export interface WeekendDigestSelection {
  weekendStart: string;
  weekendEnd: string;
  sections: WeekendDigestSection[];
  events: DigestCandidateOccurrence[];
  eligibleCount: number;
  duplicatesRemoved: number;
  qualityExclusions: number;
}

export interface WeekendDigestSelectionOptions {
  maxPerSection?: number;
  /** Reserved for a later, reviewed ranking version. Counts are accepted by
   * the API but intentionally ignored today, so RSVP popularity cannot
   * silently change production recommendations. */
  rsvpCounts?: Readonly<Record<string, number>>;
}

export function selectWeekendDigestEvents(
  candidates: readonly DigestCandidateOccurrence[],
  period: WeekendDigestPeriod,
  options: WeekendDigestSelectionOptions = {},
): WeekendDigestSelection {
  void options.rsvpCounts;
  const maxPerSection = options.maxPerSection ?? DEFAULT_WEEKEND_MAX_PER_SECTION;
  const inWindow = candidates.filter((event) => isInWeekendWindow(event, period));
  const strong = inWindow.filter(isStrongWeeklyCandidate);
  const deduped = dedupeMirroredDigestCandidates(strong);
  const weekly = selectWeeklyDigestEvents(deduped, {
    weekStart: period.weekendStart,
    weekEnd: period.weekendEnd,
    days: period.days,
  }, maxPerSection);
  const keys: WeekendSectionKey[] = ['thursday_evening', 'friday', 'saturday'];
  const eligibleBySection = period.days.map((localDate) => selectDigestEvents(deduped, {
    localDate,
    targetLatitude: TEL_AVIV_CENTER.latitude,
    targetLongitude: TEL_AVIV_CENTER.longitude,
    maxRadiusKm: DEFAULT_DIGEST_RADIUS_KM,
    minResults: 0,
    maxResults: Math.max(deduped.length, maxPerSection),
  }));
  const sections = weekly.days.map((day, index) => ({
    key: keys[index],
    localDate: day.localDate,
    events: day.events,
    eligibleCount: eligibleBySection[index].length,
  }));
  const eligibleCount = sections.reduce((total, section) => total + section.eligibleCount, 0);
  const duplicatesRemoved = Math.max(0, strong.length - deduped.length);
  return {
    weekendStart: period.weekendStart,
    weekendEnd: period.weekendEnd,
    sections,
    events: sections.flatMap((section) => section.events),
    eligibleCount,
    duplicatesRemoved,
    qualityExclusions: Math.max(0, inWindow.length - duplicatesRemoved - eligibleCount),
  };
}

function isInWeekendWindow(event: DigestCandidateOccurrence, period: WeekendDigestPeriod): boolean {
  return period.days.some((_, index) => isInSection(event, period, index));
}

function isInSection(event: DigestCandidateOccurrence, period: WeekendDigestPeriod, index: number): boolean {
  const instant = new Date(event.startsAt);
  if (!Number.isFinite(instant.getTime())) return false;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
  }).formatToParts(instant).map((part) => [part.type, part.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const hour = parts.hour === '24' ? 0 : Number(parts.hour);
  return date === period.days[index] && (index !== 0 || hour >= 17);
}

import {
  DEFAULT_DIGEST_RADIUS_KM,
  TEL_AVIV_CENTER,
  selectDigestEvents,
  type DigestCandidateOccurrence,
} from './selectDigestEvents.ts';
import type { WeeklyDigestPeriod } from './scheduleGate.ts';

export const DEFAULT_WEEKLY_MAX_PER_DAY = 3;

export interface WeeklyDigestDay {
  localDate: string;
  events: DigestCandidateOccurrence[];
}

export interface WeeklyDigestSelection {
  weekStart: string;
  weekEnd: string;
  days: WeeklyDigestDay[];
  events: DigestCandidateOccurrence[];
}

function normalizedVenue(event: DigestCandidateOccurrence): string {
  return (event.locationName ?? event.formattedAddress ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('he')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Uses the proven Daily lifecycle/radius/mirror-dedupe/ranking engine for
 * each day, then applies a soft week-wide diversity tie-break. Validity and
 * source quality always come first; diversity never admits an invalid row. */
export function selectWeeklyDigestEvents(
  candidates: readonly DigestCandidateOccurrence[],
  period: WeeklyDigestPeriod,
  maxPerDay = DEFAULT_WEEKLY_MAX_PER_DAY,
): WeeklyDigestSelection {
  const providerCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const venueCounts = new Map<string, number>();
  const seenOccurrences = new Set<string>();
  const days: WeeklyDigestDay[] = [];

  for (const localDate of period.days) {
    const ranked = selectDigestEvents(candidates, {
      localDate,
      targetLatitude: TEL_AVIV_CENTER.latitude,
      targetLongitude: TEL_AVIV_CENTER.longitude,
      maxRadiusKm: DEFAULT_DIGEST_RADIUS_KM,
      minResults: 0,
      maxResults: Math.max(candidates.length, maxPerDay),
    }).filter((event) => !seenOccurrences.has(event.occurrenceId));

    const originalPosition = new Map(ranked.map((event, index) => [event.occurrenceId, index]));
    const events: DigestCandidateOccurrence[] = [];
    while (events.length < maxPerDay && ranked.length > 0) {
      ranked.sort((left, right) => {
        const leftVenue = normalizedVenue(left);
        const rightVenue = normalizedVenue(right);
        const leftPenalty = (providerCounts.get(left.provider) ?? 0) * 2
          + (categoryCounts.get(left.category) ?? 0)
          + (leftVenue ? (venueCounts.get(leftVenue) ?? 0) * 1.5 : 0);
        const rightPenalty = (providerCounts.get(right.provider) ?? 0) * 2
          + (categoryCounts.get(right.category) ?? 0)
          + (rightVenue ? (venueCounts.get(rightVenue) ?? 0) * 1.5 : 0);
        return ((originalPosition.get(left.occurrenceId) ?? 0) + leftPenalty)
          - ((originalPosition.get(right.occurrenceId) ?? 0) + rightPenalty)
          || Date.parse(left.startsAt) - Date.parse(right.startsAt)
          || left.title.localeCompare(right.title);
      });
      const event = ranked.shift()!;
      events.push(event);
      seenOccurrences.add(event.occurrenceId);
      providerCounts.set(event.provider, (providerCounts.get(event.provider) ?? 0) + 1);
      categoryCounts.set(event.category, (categoryCounts.get(event.category) ?? 0) + 1);
      const venue = normalizedVenue(event);
      if (venue) venueCounts.set(venue, (venueCounts.get(venue) ?? 0) + 1);
    }
    days.push({ localDate, events });
  }

  return {
    weekStart: period.weekStart,
    weekEnd: period.weekEnd,
    days,
    events: days.flatMap((day) => day.events),
  };
}

export interface WeeklySocialDigest {
  city: string;
  timezone: string;
  weekStart: string;
  weekEnd: string;
  days: Array<{
    localDate: string;
    events: Array<{
      occurrenceId: string;
      title: string;
      startsAt: string;
      locationName: string | null;
      ageMinMonths: number | null;
      ageMaxMonths: number | null;
      priceNote: string | null;
      category: string;
      provider: string;
      sourceUrl: string | null;
    }>;
  }>;
}

/** Public-facts-only representation for a future social-content workflow.
 * It does not post, translate, scrape, or include any user/profile fields. */
export function buildWeeklySocialDigest(
  selection: WeeklyDigestSelection,
  city: string,
  timezone = 'Asia/Jerusalem',
): WeeklySocialDigest {
  return {
    city,
    timezone,
    weekStart: selection.weekStart,
    weekEnd: selection.weekEnd,
    days: selection.days.map((day) => ({
      localDate: day.localDate,
      events: day.events.map((event) => ({
        occurrenceId: event.occurrenceId,
        title: event.title,
        startsAt: event.startsAt,
        locationName: event.locationName,
        ageMinMonths: event.ageMinMonths,
        ageMaxMonths: event.ageMaxMonths,
        priceNote: event.priceNote,
        category: event.category,
        provider: event.provider,
        sourceUrl: event.sourceUrl ?? null,
      })),
    })),
  };
}

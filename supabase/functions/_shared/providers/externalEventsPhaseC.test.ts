/** Cross-provider dedupe and lifecycle tests for Phase C (Tel Aviv Port +
 *  Cinematheque going live alongside DigiTel and Beit Ariela).
 *
 *  These use the REAL classifyCrossProviderMatch and buildProviderSyncPlan
 *  from providers/identity.ts and providers/syncPlan.ts — already
 *  exhaustively tested generically — with real candidate shapes produced
 *  by the two new connectors' own mapping functions, plus the two actual
 *  AMBIGUOUS cases this sprint's live dry runs found (not fabricated
 *  examples): Tel Aviv Port's GLOW exhibition against a nearby DigiTel
 *  port event, and Cinematheque's Toy Story 5 against DigiTel's own
 *  "שבת סרט - צעצוע של סיפור 5" entry at the same building. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyCrossProviderMatch } from './identity.ts';
import { buildProviderSyncPlan } from './syncPlan.ts';
import { mapTelAvivPortRecord } from '../telAvivPort/mapping.ts';
import { mapCinemathequeOccurrence } from '../cinematheque/mapping.ts';

// ===========================================================================
// REAL CASE 1 — Tel Aviv Port GLOW vs a nearby DigiTel port event
// ===========================================================================

test('GLOW (Tel Aviv Port) vs a real nearby DigiTel port event classifies AMBIGUOUS, never EXACT', () => {
  const glow = mapTelAvivPortRecord({
    slug: 'glow', title: 'אורות, לייזרים וחדר מלא בלונים: תערוכת GLOW מגיעה לנמל תל אביב',
    termIds: ['17', '47', '55', '69'], description: 'תערוכה ממוזגת. 📍 האנגר 11, נמל תל אביב',
    priceText: null, registrationUrl: null, venueLine: 'האנגר 11, נמל תל אביב',
    startsAt: '2026-08-13T21:00:00.000Z', endsAt: '2026-08-30T21:00:00.000Z',
    sourceUrl: 'https://www.namal.co.il/events/glow/',
  }).candidate!;

  // Real DigiTel entry from the 2026-08-19 snapshot: "שרים עם שירי - בנמל!"
  // at "מתחם ליפקין שחק- שטח הנמל 15", ~178m from Hangar 11.
  const digitelPortEvent = {
    provider: 'tel_aviv_digitel', title: 'שרים עם שירי - בנמל!',
    startsAt: '2026-08-18T16:30:00Z', locationName: 'מתחם ליפקין שחק- שטח הנמל 15',
    latitude: 32.099021748868, longitude: 34.7738270867459,
  };

  const result = classifyCrossProviderMatch(
    { provider: 'tel_aviv_port', title: glow.title, startsAt: glow.startTime, locationName: glow.locationName, latitude: glow.latitude, longitude: glow.longitude },
    digitelPortEvent,
  );
  assert.notEqual(result.classification, 'EXACT');
  assert.equal(result.classification, 'AMBIGUOUS');
  assert.ok(result.distanceMeters! < 300, 'proximity, not title similarity, is what drives this AMBIGUOUS flag');
});

// ===========================================================================
// REAL CASE 2 — Cinematheque Toy Story 5 vs DigiTel's own Toy Story 5 entry
// ===========================================================================

test('Cinematheque Toy Story 5 vs DigiTel\'s own Toy Story 5 at the same address classifies AMBIGUOUS, never EXACT', () => {
  const toyStory = mapCinemathequeOccurrence({
    eventId: '116050', ticketId: '132398', title: 'צעצוע של סיפור 5 - מדובב | המרכז למשפחה',
    sourceUrl: 'https://www.cinema.co.il/event/toy-story-5/', durationMinutes: 102,
    director: 'מקינה האריס', language: 'מדובב לעברית', country: 'ארה"ב', year: '2026',
    description: null, hall: null, startsAt: '2026-08-22T11:00:00+03:00',
  }).candidate!;

  // Real DigiTel entry from the 2026-08-19 snapshot: same day, same building
  // address (הארבעה 5 — the Cinematheque's own address), ~1 hour apart.
  const digitelToyStory = {
    provider: 'tel_aviv_digitel', title: 'שבת סרט - צעצוע של סיפור 5',
    startsAt: '2026-08-22T09:00:00Z', locationName: 'הארבעה 5',
    latitude: 32.0706651539424, longitude: 34.7833500085449,
  };

  const result = classifyCrossProviderMatch(
    { provider: 'tel_aviv_cinematheque', title: toyStory.title, startsAt: toyStory.startTime, locationName: toyStory.locationName, latitude: toyStory.latitude, longitude: toyStory.longitude },
    digitelToyStory,
  );
  assert.notEqual(result.classification, 'EXACT');
  assert.equal(result.classification, 'AMBIGUOUS');
});

// ===========================================================================
// LEGITIMATE SEPARATE OCCURRENCES — never collapsed by title+venue similarity
// ===========================================================================

test('two different showtimes of the SAME Cinematheque film never classify against each other as duplicates — they are legitimately separate Occurrences of one Event, not a cross-provider dedupe question at all', () => {
  const showtime1 = mapCinemathequeOccurrence({
    eventId: '116049', ticketId: '131769', title: 'היפהפייה והיחפן - מדובב',
    sourceUrl: 'https://www.cinema.co.il/event/lady-and-the-tramp/', durationMinutes: 78,
    director: null, language: null, country: null, year: null, description: null, hall: null,
    startsAt: '2026-08-21T13:30:00+03:00',
  }).candidate!;
  const showtime2 = mapCinemathequeOccurrence({
    eventId: '116049', ticketId: '131770', title: 'היפהפייה והיחפן - מדובב',
    sourceUrl: 'https://www.cinema.co.il/event/lady-and-the-tramp/', durationMinutes: 78,
    director: null, language: null, country: null, year: null, description: null, hall: null,
    startsAt: '2026-08-22T11:00:00+03:00',
  }).candidate!;

  // Same providerEventId — the DB groups these as one Event with two
  // Occurrences via the shared apply_complete_provider_sync RPC, not via
  // this cross-provider classifier at all.
  assert.equal(showtime1.providerEventId, showtime2.providerEventId);
  assert.notEqual(showtime1.occurrenceFingerprint, showtime2.occurrenceFingerprint);
});

// ===========================================================================
// RSVP SAFETY / IDEMPOTENCE — via the real, already-tested syncPlan core
// ===========================================================================

test('a second sync pass against unchanged Port/Cinematheque source state produces zero inserts and zero archive/delete — reusing the real syncPlan core', () => {
  const glow = mapTelAvivPortRecord({
    slug: 'glow', title: 'GLOW', termIds: ['47'], description: 'לילדים', priceText: null,
    registrationUrl: null, venueLine: null, startsAt: '2026-08-13T21:00:00.000Z',
    endsAt: '2026-08-30T21:00:00.000Z', sourceUrl: 'https://www.namal.co.il/events/glow/',
  }).candidate!;

  const existingFromFirstRun = [{
    occurrenceId: 'occ-1', eventId: 'event-1', occurrenceFingerprint: glow.occurrenceFingerprint,
    providerTransportId: glow.providerTransportId, startsAt: glow.startTime, endsAt: glow.endTime,
    provider: 'tel_aviv_port', missingSince: null, archivedAt: null, sourceUpdatedAt: null,
    hasAttendees: true, // a real RSVP exists on this occurrence
  }];

  const secondRunPlan = buildProviderSyncPlan({
    provider: 'tel_aviv_port', candidates: [glow], existing: existingFromFirstRun,
    sourceComplete: true, now: new Date('2026-08-19T12:00:00Z'),
  });

  assert.equal(secondRunPlan.inserts.length, 0);
  assert.equal(secondRunPlan.archive.length, 0);
  assert.equal(secondRunPlan.hardDelete.length, 0);
  assert.equal(secondRunPlan.newlyMissing.length, 0);
  assert.equal(secondRunPlan.seen.length, 1, 'the existing occurrence is recognized, not treated as new');
});

// ===========================================================================
// SOURCE FAILURE — no destructive decisions from an incomplete fetch
// ===========================================================================

test('an incomplete fetch (sourceComplete=false) never archives or deletes anything, for either new provider', () => {
  const plan = buildProviderSyncPlan({
    provider: 'tel_aviv_cinematheque', candidates: [], existing: [{
      occurrenceId: 'occ-1', eventId: 'event-1', occurrenceFingerprint: 'fp-1',
      providerTransportId: '131769', startsAt: '2026-08-21T10:30:00Z', endsAt: null,
      provider: 'tel_aviv_cinematheque', missingSince: null, archivedAt: null,
      sourceUpdatedAt: null, hasAttendees: false,
    }],
    sourceComplete: false, now: new Date('2026-08-25T00:00:00Z'),
  });
  assert.equal(plan.archive.length, 0);
  assert.equal(plan.hardDelete.length, 0);
  assert.equal(plan.newlyMissing.length, 0);
});

/** The generic provider contract.
 *
 *  Every connector — DigiTel's ArcGIS feed, Beit Ariela's HTML pages, and
 *  whatever comes after them — normalizes into THIS shape before it ever
 *  touches shared code. `relevance.ts`, `syncPlan.ts` and `identity.ts` know
 *  nothing about ArcGIS or Kirby CMS; they only know this interface. That is
 *  what makes adding provider #3 a matter of writing fetch+parse+normalize
 *  and nothing else — the dangerous, shared, already-tested code does not
 *  change.
 *
 *  DigiTel's own `DigitelEventCandidate` (in
 *  supabase/functions/_shared/digitel/connector.ts) is intentionally left
 *  alone rather than rewritten to extend this type. It already satisfies this
 *  shape structurally — every field below exists on it under the same name —
 *  so DigiTel candidates type-check anywhere a ProviderCandidate is expected
 *  with zero changes to DigiTel's code. Proven in
 *  providers/syncPlan.test.ts. */

export type SourceType = 'municipal' | 'external_organizer';

export interface ProviderCandidate {
  /** Content-derived identity: changes if the meaningful content changes.
   *  Used as the primary match key. */
  providerEventId: string;
  /** The source's own stable identifier for this record (an ArcGIS OBJECTID,
   *  a CMS slug). Used as the fallback match key when the content-derived id
   *  has changed but the underlying record has not. */
  providerTransportId: string;
  /** Null when a provider has no native series/grouping concept. */
  sourceGroupId: string | null;
  title: string;
  description: string | null;
  /** One of EVENT_CATEGORIES (src/types/event.ts) as a plain string here —
   *  the shared modules do not import app types, to stay usable from a Deno
   *  Edge Function with no bundler. */
  category: string;
  sourceType: SourceType;
  /** This event's own page. Distinct from the provider's home page. */
  sourceUrl: string;
  startTime: string;
  endTime: string | null;
  locationName: string;
  formattedAddress: string | null;
  latitude: number;
  longitude: number;
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  /** Human-readable price text ("20 ₪", "free"). Never a parsed number a
   *  connector guessed at — see priceParsing.ts for the one place that is
   *  allowed to interpret this. */
  priceNote: string | null;
  registrationRequired: boolean | null;
  registrationUrl: string | null;
  /** true / false / null — see airConditioning.ts. Never inferred from venue
   *  type. A library is not air-conditioned because it is a library; it is
   *  air-conditioned only if the source says so. */
  airConditioned: boolean | null;
  indoorOutdoor: 'indoor' | 'outdoor' | 'mixed' | null;
  sourcePublishedAt: string | null;
  sourceUpdatedAt: string | null;
  /** Non-secret only. The source's own image URL is retained HERE for
   *  provenance/audit, never copied into an app-facing image field unless a
   *  separate rights check has cleared it — see imageRights.ts. */
  providerMetadata: Record<string, string | number | boolean | null>;
  occurrenceFingerprint: string;
}

/** What the generic sync core already knows about an existing DB row, so
 *  `syncPlan.ts` can decide insert/update/missing/archive without a
 *  database connection of its own. Mirrors digitel/syncPlan.ts's
 *  `ExistingOccurrence`, generalized to drop the DigiTel-specific
 *  `sourceGroupId` stable-key fallback (see the SQL migration's comment on
 *  why that fallback is not reproduced generically). */
export interface ExistingProviderOccurrence {
  occurrenceId: string;
  eventId: string;
  occurrenceFingerprint: string;
  /** events.provider_transport_id — the fallback match key used when the
   *  content fingerprint has drifted but the underlying record has not. */
  providerTransportId: string | null;
  startsAt: string;
  endsAt: string | null;
  provider: string;
  missingSince: string | null;
  archivedAt: string | null;
  sourceUpdatedAt: string | null;
  hasAttendees: boolean;
}

export interface FetchOutcome<TCandidate> {
  candidates: TCandidate[];
  /** True only when the fetch covered its entire intended scope with no
   *  errors, no missing pages, no parse failures above tolerance, and no
   *  detected structural drift. Every destructive decision downstream is
   *  gated on this being true — see syncPlan.ts. */
  sourceComplete: boolean;
  pagesFetched: number;
  rawRecordCount: number;
  /** Populated only when sourceComplete is false, so a dry-run report or an
   *  ops alert can say why without re-deriving it. */
  incompleteReason: string | null;
}

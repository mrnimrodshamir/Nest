/** Source badge — the data model only. No generic badge component yet; Section 5 of the
 *  design brief is explicit that the UI is not to be overbuilt in this phase.
 *  What exists here is enough for a future `<SourceBadge>` to render from
 *  without inventing its own classification logic, and enough for tests to
 *  pin the classification rules now, before any screen depends on them.
 *
 *  Three source kinds, deliberately including one the database's
 *  `events.source_type` column does NOT: `nestup_community`. The `events`
 *  table only ever holds provider-sourced content (see
 *  0009_events_domain.sql — "never stores user activities"), so that column
 *  is rightly a two-value constraint. A NestUp-hosted Activity is a
 *  different table entirely, but Discovery renders Activities, Places and
 *  Events side by side — so THIS type, used only to decide what a card shows
 *  about its origin, needs the third case even though no database row ever
 *  carries it directly. */
export type SourceKind = 'municipal' | 'external_organizer' | 'nestup_community';

export interface SourceBadgeInfo {
  kind: SourceKind;
  /** What the badge displays — "עיריית תל אביב-יפו", "בית אריאלה וספריות
   *  תל אביב-יפו", or null for a NestUp community Activity, which shows the
   *  host instead of a source label. */
  label: string | null;
  /** The provider's own home page, for a detail-screen link. Null for
   *  nestup_community — there is no external provider to link to. */
  providerUrl: string | null;
}

/** Canonical provider identity for events imported from the Tel Aviv-Yafo
 * municipality's DigiTel feed. Keep this provider-specific: other municipal
 * sources (for example Beit Ariela) have their own visual identity. */
export const TEL_AVIV_DIGITEL_PROVIDER = 'tel_aviv_digitel' as const;

export function isTelAvivMunicipalEvent(event: {
  source: { provider: string };
}): boolean {
  return event.source.provider === TEL_AVIV_DIGITEL_PROVIDER;
}

/** Built from an Event's own source_type/source_name/provider_url — never
 *  re-derives them from the provider key, so a badge always reflects
 *  whatever the database actually has, including a provider added after this
 *  function was last touched. */
export function sourceBadgeForEvent(event: {
  sourceType: 'municipal' | 'external_organizer';
  sourceName: string;
  providerUrl: string | null;
}): SourceBadgeInfo {
  return { kind: event.sourceType, label: event.sourceName, providerUrl: event.providerUrl };
}

/** A user-created Activity has no provider — it has a host. This exists so a
 *  caller does not need an if/else at every call site: Activities and Events
 *  both resolve to a SourceBadgeInfo, and only Events ever carry a label. */
export function sourceBadgeForActivity(): SourceBadgeInfo {
  return { kind: 'nestup_community', label: null, providerUrl: null };
}

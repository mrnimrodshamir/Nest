import { createClient } from '@supabase/supabase-js';
import {
  fetchAllDigitelFeatures,
  mapSourceRecord,
  normalizeDigitelFeatures,
} from '../supabase/functions/_shared/digitel/connector.ts';
import { deduplicateDigitelCandidates } from '../supabase/functions/_shared/digitel/staging.ts';
import {
  assessFamilyRelevance,
  assessLegacyFamilyRelevance,
} from '../supabase/functions/_shared/digitel/relevance.ts';
import { buildSyncPlan } from '../supabase/functions/_shared/digitel/syncPlan.ts';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');

const now = new Date();
const fetched = await fetchAllDigitelFeatures();
const normalized = normalizeDigitelFeatures(fetched.features, { now });
const deduplicated = deduplicateDigitelCandidates(normalized.candidates);
const candidates = deduplicated.uniqueCandidates;
const currentDecisions = new Map(candidates.map((candidate) => [candidate.providerTransportId, relevance(candidate, assessFamilyRelevance)]));
const legacyDecisions = new Map(candidates.map((candidate) => [candidate.providerTransportId, relevance(candidate, assessLegacyFamilyRelevance)]));
const candidatesByTransport = new Map(candidates.map((candidate) => [candidate.providerTransportId, candidate]));
const candidatesByFingerprint = new Map(candidates.map((candidate) => [candidate.occurrenceFingerprint, candidate]));
const duplicateStableSourceKeys = duplicateValues(candidates.map((candidate) => stableSourceKey(candidate.sourceGroupId, candidate.startTime)));
const rawTransportIds = new Set(fetched.features.flatMap((feature) => {
  const id = mapSourceRecord(feature).objectId;
  return id == null ? [] : [String(id)];
}));

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const occurrences = await allRows((from, to) => client
  .from('event_occurrences')
  .select('id,event_id,provider_occurrence_id,occurrence_fingerprint,starts_at,ends_at,missing_since,archived_at,last_seen_at,source_updated_at,event_attendees(id),events!inner(id,provider,provider_event_id,provider_transport_id,source_group_id,title,publication_status,is_visible,last_seen_at)')
  .eq('events.provider', 'tel_aviv_digitel')
  .range(from, to));
const activeFuture = await countRows(client.from('active_event_occurrences').select('occurrence_id', { count: 'exact', head: true }));
const allActivities = await countRows(client.from('activities').select('id', { count: 'exact', head: true }));
const proposedPlan = buildSyncPlan({
  candidates,
  existing: occurrences.map((row) => ({
    occurrenceId: row.id,
    eventId: row.event_id,
    occurrenceFingerprint: row.occurrence_fingerprint,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    provider: eventOf(row).provider,
    missingSince: row.missing_since,
    archivedAt: row.archived_at,
    sourceUpdatedAt: row.source_updated_at,
    sourceGroupId: eventOf(row).source_group_id,
    hasAttendees: Array.isArray(row.event_attendees) && row.event_attendees.length > 0,
  })),
  sourceComplete: true,
  now,
  provider: 'tel_aviv_digitel',
});

const predicted = occurrences.filter((row) => {
  if (row.archived_at) return false;
  const end = Date.parse(row.ends_at ?? row.starts_at);
  if (!Number.isFinite(end) || end < now.getTime()) return false;
  const candidate = candidatesByFingerprint.get(row.occurrence_fingerprint);
  return !candidate || !currentDecisions.get(candidate.providerTransportId)?.relevant;
});

const duplicateTransportIds = duplicateValues(occurrences.map((row) => String(row.provider_occurrence_id ?? '')));
const duplicateFingerprints = duplicateValues(occurrences.map((row) => row.occurrence_fingerprint));
const duplicateProviderEventIds = duplicateValues(occurrences.map((row) => String(eventOf(row).provider_event_id ?? '')));
const classes = Object.fromEntries(['A', 'B', 'C', 'D', 'E', 'F'].map((key) => [key, []]));
for (const row of predicted) {
  const transportId = String(row.provider_occurrence_id ?? eventOf(row).provider_transport_id ?? '');
  const exactFingerprint = candidatesByFingerprint.get(row.occurrence_fingerprint);
  const driftCandidate = findDriftCandidate(row, candidates);
  const ended = Date.parse(row.ends_at ?? row.starts_at) < now.getTime();
  if (ended) classes.A.push(row);
  else if (duplicateTransportIds.has(transportId) || duplicateFingerprints.has(row.occurrence_fingerprint)) classes.E.push(row);
  else if (exactFingerprint && !currentDecisions.get(exactFingerprint.providerTransportId)?.relevant) classes.B.push(row);
  else if (driftCandidate) classes.C.push(row);
  else if (!rawTransportIds.has(transportId)) classes.D.push(row);
  else classes.F.push(row);
}

const changedByFilter = candidates.filter((candidate) => legacyDecisions.get(candidate.providerTransportId)?.relevant && !currentDecisions.get(candidate.providerTransportId)?.relevant);
const rejectionReasons = frequency(changedByFilter.map((candidate) => currentDecisions.get(candidate.providerTransportId)?.reason ?? 'unknown'));
const predictedReasons = frequency(classes.B.map((row) => {
  const candidate = candidatesByFingerprint.get(row.occurrence_fingerprint);
  return candidate ? currentDecisions.get(candidate.providerTransportId)?.reason ?? 'unknown' : 'unknown';
}));
const result = {
  observedAt: now.toISOString(),
  source: { fetched: fetched.features.length, pages: fetched.pages, structurallyValid: candidates.length, structurallyExcluded: normalized.excluded.length, duplicateRecords: deduplicated.duplicateRecordCount },
  production: {
    occurrences: occurrences.length,
    activeFuture,
    activitiesUnaffectedCount: allActivities,
    rsvpLinkedOccurrences: occurrences.filter((row) => Array.isArray(row.event_attendees) && row.event_attendees.length > 0).length,
    duplicateProviderEventIds: duplicateProviderEventIds.size,
    duplicateProviderTransportIds: duplicateTransportIds.size,
    duplicateOccurrenceFingerprints: duplicateFingerprints.size,
  },
  predictedMissing: predicted.length,
  classification: Object.fromEntries(Object.entries(classes).map(([key, rows]) => [key, rows.length])),
  relevance: {
    legacyAccepted: [...legacyDecisions.values()].filter((decision) => decision.relevant).length,
    currentAccepted: [...currentDecisions.values()].filter((decision) => decision.relevant).length,
    previouslyAcceptedNowRejected: changedByFilter.length,
    rejectionReasons,
    predictedMissingRejectionReasons: predictedReasons,
    predictedMissingSourceTypes: frequency(classes.B.map((row) => candidatesByFingerprint.get(row.occurrence_fingerprint)?.sourceType ?? 'missing')),
    predictedMissingLegacySignals: frequency(classes.B.flatMap((row) => {
      const candidate = candidatesByFingerprint.get(row.occurrence_fingerprint);
      if (!candidate) return ['missing'];
      const decision = legacyDecisions.get(candidate.providerTransportId);
      return decision?.relevant ? decision.matched : [decision?.reason ?? 'unknown'];
    })),
    examples: classes.B.slice(0, 12).map((row) => {
      const candidate = candidatesByFingerprint.get(row.occurrence_fingerprint);
      return { storedTransportId: row.provider_occurrence_id, currentTransportId: candidate?.providerTransportId, title: candidate?.title ?? eventOf(row).title, sourceType: candidate?.sourceType, reason: candidate ? currentDecisions.get(candidate.providerTransportId)?.reason : 'unknown' };
    }),
  },
  correctedDryRun: {
    fetched: fetched.features.length,
    relevant: proposedPlan.inserts.length + proposedPlan.updates.length + proposedPlan.unchanged.length,
    excludedButStillPresent: proposedPlan.excludedButPresent.length,
    new: proposedPlan.inserts.length,
    updated: proposedPlan.updates.length,
    unchanged: proposedPlan.unchanged.length,
    genuinelyMissing: proposedPlan.newlyMissing.length,
    archiveCandidates: proposedPlan.archive.length + proposedPlan.preserveForUserData.length,
    deleteCandidates: proposedPlan.hardDelete.length,
  },
  fingerprintDrift: classes.C.slice(0, 20).map((row) => {
    const candidate = findDriftCandidate(row, candidates);
    return { storedTransportId: row.provider_occurrence_id, currentTransportId: candidate?.providerTransportId, stored: row.occurrence_fingerprint, current: candidate?.occurrenceFingerprint, title: eventOf(row).title, currentTitle: candidate?.title };
  }),
  identity: {
    exactFingerprintMatches: occurrences.filter((row) => candidatesByFingerprint.has(row.occurrence_fingerprint)).length,
    stableSourceKeyDuplicates: duplicateStableSourceKeys.size,
    candidatesMissingSourceGroupId: candidates.filter((candidate) => !candidate.sourceGroupId?.trim()).length,
    transportIdMatches: occurrences.filter((row) => candidatesByTransport.has(String(row.provider_occurrence_id ?? ''))).length,
  },
  absentExamples: classes.D.slice(0, 20).map((row) => ({ transportId: row.provider_occurrence_id, title: eventOf(row).title, startsAt: row.starts_at })),
};
console.log(JSON.stringify(result, null, 2));

function relevance(candidate, assess) {
  return assess({ title: candidate.title, description: candidate.description, sourceType: candidate.sourceType, locationName: candidate.locationName });
}

function eventOf(row) {
  return Array.isArray(row.events) ? row.events[0] ?? {} : row.events ?? {};
}

function findDriftCandidate(row, sourceCandidates) {
  const event = eventOf(row);
  const start = Date.parse(row.starts_at);
  const group = String(event.source_group_id ?? '');
  const sameGroupAndTime = group
    ? sourceCandidates.filter((candidate) => candidate.sourceGroupId === group && Math.abs(Date.parse(candidate.startTime) - start) < 60_000)
    : [];
  if (sameGroupAndTime.length === 1) return sameGroupAndTime[0];
  const title = normalizeIdentityText(String(event.title ?? ''));
  const sameTitleAndTime = sourceCandidates.filter((candidate) => normalizeIdentityText(candidate.title) === title && Math.abs(Date.parse(candidate.startTime) - start) < 60_000);
  return sameTitleAndTime.length === 1 ? sameTitleAndTime[0] : null;
}

function normalizeIdentityText(value) {
  return value.normalize('NFKC').toLocaleLowerCase('he').replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/gu, ' ').trim();
}

function stableSourceKey(sourceGroupId, startsAt) {
  if (!sourceGroupId?.trim()) return '';
  const timestamp = Date.parse(startsAt);
  return Number.isFinite(timestamp) ? `${sourceGroupId.trim()}|${new Date(timestamp).toISOString()}` : '';
}

async function allRows(queryPage) {
  const rows = [];
  for (let from = 0; ; from += 1_000) {
    const { data, error } = await queryPage(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1_000) return rows;
  }
}

async function countRows(query) {
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values.filter(Boolean)) seen.has(value) ? duplicates.add(value) : seen.add(value);
  return duplicates;
}

function frequency(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

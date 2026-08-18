// @ts-nocheck -- Supabase Edge Functions provide Deno and npm: imports at runtime.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { runGenericProviderSync, type GenericSyncDatabase, type GenericSyncRunOutcome } from '../_shared/providers/genericSyncHandler.ts';
import { fetchTelAvivPortCandidates } from '../_shared/telAvivPort/connector.ts';
import { mapTelAvivPortRecord, isFamilyTagged, TEL_AVIV_PORT_PROVIDER_KEY, TEL_AVIV_PORT_SOURCE_NAME, TEL_AVIV_PORT_PROVIDER_URL } from '../_shared/telAvivPort/mapping.ts';

const jsonHeaders = { 'Content-Type': 'application/json' };

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return response(405, { error: 'METHOD_NOT_ALLOWED' });
  if (!isServiceRole(request.headers.get('authorization'))) return response(403, { error: 'FORBIDDEN' });

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !serviceKey) return response(500, { error: 'CONFIGURATION_MISSING' });
  const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const database = createDatabase(client);

  try {
    const outcome = await runGenericProviderSync({
      providerKey: TEL_AVIV_PORT_PROVIDER_KEY,
      sourceName: TEL_AVIV_PORT_SOURCE_NAME,
      providerUrl: TEL_AVIV_PORT_PROVIDER_URL,
      fetchCandidates: async () => {
        const fetchResult = await fetchTelAvivPortCandidates({ horizonDays: 7 });
        const familyTagged = fetchResult.records.filter((r) => isFamilyTagged(r.termIds));
        const candidates = familyTagged.map((r) => mapTelAvivPortRecord(r)).filter((row) => row.candidate).map((row) => row.candidate);
        return { candidates, sourceComplete: fetchResult.sourceComplete, incompleteReason: fetchResult.incompleteReason, rawCount: fetchResult.rawListItemCount };
      },
    }, database);
    return response(200, outcome);
  } catch (error) {
    return response(502, { error: 'SYNC_FAILED', message: error instanceof Error ? error.message : 'unknown' });
  }
});

function createDatabase(client: any): GenericSyncDatabase {
  return {
    async startRun(provider: string) {
      const { data, error } = await client.from('provider_sync_runs').insert({ provider, status: 'running' }).select('id').single();
      if (error) throw new Error(`Could not start sync run: ${error.message}`);
      return data.id;
    },
    async finishRun(runId: string, _provider: string, outcome: GenericSyncRunOutcome) {
      const { error } = await client.from('provider_sync_runs').update({
        status: outcome.status === 'success' ? 'success' : outcome.status === 'partial' ? 'partial' : 'failed',
        source_complete: outcome.sourceComplete, source_records_fetched: outcome.fetched, normalized: outcome.normalized,
        excluded: outcome.excluded, inserted: outcome.inserted, updated: outcome.updated, unchanged: outcome.unchanged,
        archived: outcome.archived, cleaned: outcome.cleaned, stale_unpublished: outcome.missing,
        duplicates: 0, errors: outcome.errors, error_summary: outcome.errorSummary, completed_at: new Date().toISOString(),
      }).eq('id', runId);
      if (error) throw new Error(`Could not finish sync run: ${error.message}`);
    },
    async listExisting(provider: string) {
      // provider_occurrence_id lives on event_occurrences (per-occurrence),
      // NOT events.provider_transport_id (per-event, first-write-wins) —
      // this is what makes the fallback match key correct when one Event
      // has multiple Occurrences each with their own transport id (e.g.
      // Cinematheque: one film, several showtimes, each a different
      // cintlv.pres.global ticket id).
      const { data, error } = await client.from('event_occurrences').select(`
        id,event_id,occurrence_fingerprint,provider_occurrence_id,starts_at,ends_at,missing_since,archived_at,source_updated_at,
        events!inner(provider),event_attendees(id)
      `).eq('events.provider', provider);
      if (error) throw new Error(`Could not load existing occurrences: ${error.message}`);
      return (data ?? []).map((row: any) => ({
        occurrenceId: row.id, eventId: row.event_id, occurrenceFingerprint: row.occurrence_fingerprint,
        providerTransportId: row.provider_occurrence_id, startsAt: row.starts_at, endsAt: row.ends_at,
        provider: row.events.provider, missingSince: row.missing_since, archivedAt: row.archived_at,
        sourceUpdatedAt: row.source_updated_at,
        hasAttendees: Array.isArray(row.event_attendees) && row.event_attendees.length > 0,
      }));
    },
    async applyCompleteSync(input) {
      const { data, error } = await client.rpc('apply_complete_provider_sync', {
        p_provider: input.provider, p_run_id: input.runId, p_observed_at: input.observedAt,
        p_source_complete: input.sourceComplete, p_candidates: input.candidates,
      });
      if (error) throw new Error(`apply_complete_provider_sync failed: ${error.message}`);
      return data;
    },
  };
}

function isServiceRole(authorization: string | null): boolean {
  const token = authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  try {
    const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))));
    return payload.role === 'service_role';
  } catch { return false; }
}

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

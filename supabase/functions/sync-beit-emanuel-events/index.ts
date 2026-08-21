// @ts-nocheck -- Supabase Edge Functions provide Deno and npm: imports at runtime.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { runGenericProviderDryRun, runGenericProviderSync } from '../_shared/providers/genericSyncHandler.ts';
import { fetchBeitEmanuelCandidates } from '../_shared/beitEmanuel/connector.ts';
import { dedupeBeitEmanuelCandidates, mapBeitEmanuelRecord, BEIT_EMANUEL_PROVIDER_KEY, BEIT_EMANUEL_PROVIDER_URL, BEIT_EMANUEL_SOURCE_NAME } from '../_shared/beitEmanuel/mapping.ts';

const headers = { 'Content-Type': 'application/json' };
Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return respond(405, { error: 'METHOD_NOT_ALLOWED' });
  if (!isServiceRole(request.headers.get('authorization'))) return respond(403, { error: 'FORBIDDEN' });
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !key) return respond(500, { error: 'CONFIGURATION_MISSING' });
  const body = await request.json().catch(() => ({}));
  if (typeof body.dryRun !== 'boolean') return respond(400, { error: 'DRY_RUN_REQUIRED' });
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const database = createDatabase(client);
  const config = {
    providerKey: BEIT_EMANUEL_PROVIDER_KEY, cityId: 'ramat_gan', sourceName: BEIT_EMANUEL_SOURCE_NAME,
    providerUrl: BEIT_EMANUEL_PROVIDER_URL,
    fetchCandidates: async () => {
      const result = await fetchBeitEmanuelCandidates({ horizonDays: 7 });
      const mapped = result.records.map(mapBeitEmanuelRecord);
      const deduped = dedupeBeitEmanuelCandidates(mapped.flatMap((row) => row.candidate ? [row.candidate] : []));
      return {
        candidates: deduped.candidates,
        sourceComplete: result.sourceComplete, incompleteReason: result.incompleteReason,
        rawCount: result.rawCount,
      };
    },
  };
  try {
    const outcome = body.dryRun
      ? await runGenericProviderDryRun(config, database)
      : await runGenericProviderSync(config, database);
    return respond(200, outcome);
  } catch (error) {
    return respond(502, { error: 'SYNC_FAILED', message: error instanceof Error ? error.message.slice(0, 300) : 'unknown' });
  }
});

function createDatabase(client: any) {
  return {
    async startRun(provider: string) { const { data, error } = await client.from('provider_sync_runs').insert({ provider, status: 'running' }).select('id').single(); if (error) throw error; return data.id; },
    async finishRun(runId: string, _provider: string, outcome: any) { const { error } = await client.from('provider_sync_runs').update({ status: outcome.status, source_complete: outcome.sourceComplete, source_records_fetched: outcome.fetched, normalized: outcome.normalized, excluded: outcome.excluded, inserted: outcome.inserted, updated: outcome.updated, unchanged: outcome.unchanged, archived: outcome.archived, cleaned: outcome.cleaned, stale_unpublished: outcome.missing, duplicates: 0, errors: outcome.errors, error_summary: outcome.errorSummary, completed_at: new Date().toISOString() }).eq('id', runId); if (error) throw error; },
    async listExisting(provider: string) { const { data, error } = await client.from('event_occurrences').select('id,event_id,occurrence_fingerprint,provider_occurrence_id,starts_at,ends_at,missing_since,archived_at,source_updated_at,events!inner(provider),event_attendees(id)').eq('events.provider', provider); if (error) throw error; return (data ?? []).map((row: any) => ({ occurrenceId: row.id, eventId: row.event_id, occurrenceFingerprint: row.occurrence_fingerprint, providerTransportId: row.provider_occurrence_id, startsAt: row.starts_at, endsAt: row.ends_at, provider: row.events.provider, missingSince: row.missing_since, archivedAt: row.archived_at, sourceUpdatedAt: row.source_updated_at, hasAttendees: Array.isArray(row.event_attendees) && row.event_attendees.length > 0 })); },
    async applyCompleteSync(input: any) { const { data, error } = await client.rpc('apply_complete_provider_sync', { p_provider: input.provider, p_run_id: input.runId, p_observed_at: input.observedAt, p_source_complete: input.sourceComplete, p_candidates: input.candidates }); if (error) throw new Error(`apply_complete_provider_sync failed: ${error.message}`); return data; },
  };
}
function isServiceRole(value: string | null) { const token = value?.replace(/^Bearer\s+/i, ''); if (!token) return false; try { const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)))); return payload.role === 'service_role'; } catch { return false; } }
function respond(status: number, body: unknown) { return new Response(JSON.stringify(body), { status, headers }); }

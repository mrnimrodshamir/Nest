// @ts-nocheck -- Supabase Edge Functions provide Deno and npm: imports at runtime.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { runGenericProviderDryRun, runGenericProviderSync } from '../_shared/providers/genericSyncHandler.ts';
import { fetchGivatayimCandidates } from '../_shared/givatayimMunicipality/connector.ts';
import { dedupeGivatayimCandidates, mapGivatayimRecord, GIVATAYIM_PROVIDER_KEY, GIVATAYIM_PROVIDER_URL, GIVATAYIM_SOURCE_NAME } from '../_shared/givatayimMunicipality/mapping.ts';
import { classifyCrossCityCandidates } from '../_shared/providers/crossCityDedupe.ts';

const headers = { 'Content-Type': 'application/json' };
Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return respond(405, { error: 'METHOD_NOT_ALLOWED' });
  if (!isServiceRole(request.headers.get('authorization'))) return respond(403, { error: 'FORBIDDEN' });
  const url = Deno.env.get('SUPABASE_URL') ?? ''; const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !key) return respond(500, { error: 'CONFIGURATION_MISSING' });
  const body = await request.json().catch(() => ({}));
  if (typeof body.dryRun !== 'boolean') return respond(400, { error: 'DRY_RUN_REQUIRED' });
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const database = createDatabase(client);
  let crossCity = { exact: 0, probable: 0, ambiguous: 0, distinct: 0 };
  const config = { providerKey: GIVATAYIM_PROVIDER_KEY, cityId: 'givatayim', sourceName: GIVATAYIM_SOURCE_NAME, providerUrl: GIVATAYIM_PROVIDER_URL,
    fetchCandidates: async () => { const result = await fetchGivatayimCandidates({ horizonDays: 7 }); const mapped = result.records.flatMap((row) => { const candidate = mapGivatayimRecord(row); return candidate ? [candidate] : []; }); const deduped = dedupeGivatayimCandidates(mapped); const { data, error } = await client.from('active_event_occurrences').select('title,starts_at,latitude,longitude,provider,city_id').neq('provider', GIVATAYIM_PROVIDER_KEY); if (error) throw error; const classified = classifyCrossCityCandidates(deduped.candidates, (data ?? []).map((row: any) => ({ title: row.title, startsAt: row.starts_at, latitude: row.latitude, longitude: row.longitude, provider: row.provider, cityId: row.city_id }))); crossCity = { exact: classified.filter((row) => row.classification === 'EXACT').length, probable: classified.filter((row) => row.classification === 'PROBABLE').length, ambiguous: classified.filter((row) => row.classification === 'AMBIGUOUS').length, distinct: classified.filter((row) => row.classification === 'DISTINCT').length }; const safe = classified.filter((row) => row.classification === 'DISTINCT').map((row) => row.candidate); const ambiguous = crossCity.probable + crossCity.ambiguous; return { candidates: safe, sourceComplete: result.sourceComplete && ambiguous === 0, incompleteReason: result.incompleteReason ?? (ambiguous ? `${ambiguous} cross-city candidates require review` : null), rawCount: result.rawCount }; },
  };
  try { const outcome = body.dryRun ? await runGenericProviderDryRun(config, database) : await runGenericProviderSync(config, database); return respond(200, { ...outcome, crossCity }); }
  catch (error) { return respond(502, { error: 'SYNC_FAILED', message: error instanceof Error ? error.message.slice(0, 300) : 'unknown' }); }
});

function createDatabase(client: any) { return {
  async startRun(provider: string) { const { data, error } = await client.from('provider_sync_runs').insert({ provider, status: 'running' }).select('id').single(); if (error) throw error; return data.id; },
  async finishRun(runId: string, _provider: string, outcome: any) { const { error } = await client.from('provider_sync_runs').update({ status: outcome.status, source_complete: outcome.sourceComplete, source_records_fetched: outcome.fetched, normalized: outcome.normalized, excluded: outcome.excluded, inserted: outcome.inserted, updated: outcome.updated, unchanged: outcome.unchanged, archived: outcome.archived, cleaned: outcome.cleaned, stale_unpublished: outcome.missing, duplicates: 0, errors: outcome.errors, error_summary: outcome.errorSummary, completed_at: new Date().toISOString() }).eq('id', runId); if (error) throw error; },
  async listExisting(provider: string) { const { data, error } = await client.from('event_occurrences').select('id,event_id,occurrence_fingerprint,provider_occurrence_id,starts_at,ends_at,missing_since,archived_at,source_updated_at,events!inner(provider),event_attendees(id)').eq('events.provider', provider); if (error) throw error; return (data ?? []).map((row: any) => ({ occurrenceId: row.id, eventId: row.event_id, occurrenceFingerprint: row.occurrence_fingerprint, providerTransportId: row.provider_occurrence_id, startsAt: row.starts_at, endsAt: row.ends_at, provider: row.events.provider, missingSince: row.missing_since, archivedAt: row.archived_at, sourceUpdatedAt: row.source_updated_at, hasAttendees: Array.isArray(row.event_attendees) && row.event_attendees.length > 0 })); },
  async applyCompleteSync(input: any) { const { data, error } = await client.rpc('apply_complete_provider_sync', { p_provider: input.provider, p_run_id: input.runId, p_observed_at: input.observedAt, p_source_complete: input.sourceComplete, p_candidates: input.candidates }); if (error) throw new Error(`apply_complete_provider_sync failed: ${error.message}`); return data; },
}; }
function isServiceRole(value: string | null) { const token = value?.replace(/^Bearer\s+/i, ''); if (!token) return false; try { const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)))); return payload.role === 'service_role'; } catch { return false; } }
function respond(status: number, body: unknown) { return new Response(JSON.stringify(body), { status, headers }); }

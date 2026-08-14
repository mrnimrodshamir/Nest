// @ts-nocheck -- Supabase Edge Functions provide Deno and npm: imports at runtime.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { runDigitelSync, SyncExecutionError, type SyncDatabase, type SyncRunOutcome } from './handler.ts';

const jsonHeaders = { 'Content-Type': 'application/json' };

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return response(405, { error: 'METHOD_NOT_ALLOWED' });
  if (!isServiceRole(request.headers.get('authorization'))) return response(403, { error: 'FORBIDDEN' });

  let body: unknown;
  try { body = await request.json(); } catch { return response(400, { error: 'INVALID_REQUEST' }); }
  if (!isRequestBody(body)) return response(400, { error: 'INVALID_REQUEST' });

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !serviceKey) return response(500, { error: 'CONFIGURATION_MISSING' });
  const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const database = createDatabase(client);

  try {
    return response(200, await runDigitelSync({ dryRun: body.dryRun }, database));
  } catch (error) {
    return response(502, { error: 'SYNC_FAILED', runId: error instanceof SyncExecutionError ? error.runId : null });
  }
});

function createDatabase(client: any): SyncDatabase {
  return {
    async startRun() {
      const { data, error } = await client.from('provider_sync_runs').insert({ provider: 'tel_aviv_digitel', status: 'running' }).select('id').single();
      if (error) throw new Error(`Could not start sync run: ${error.message}`);
      return data.id;
    },
    async finishRun(runId: string, outcome: SyncRunOutcome) {
      const { error } = await client.from('provider_sync_runs').update({
        status: outcome.status, source_complete: outcome.sourceComplete,
        source_records_fetched: outcome.fetched, normalized: outcome.normalized,
        duplicates: outcome.duplicates, excluded: outcome.excluded,
        inserted: outcome.inserted, updated: outcome.updated, unchanged: outcome.unchanged,
        archived: outcome.archived, cleaned: outcome.cleaned, stale_unpublished: outcome.missing,
        errors: outcome.error ? 1 : 0, error_summary: outcome.error, completed_at: new Date().toISOString(),
      }).eq('id', runId);
      if (error) throw new Error(`Could not finish sync run: ${error.message}`);
    },
    async listExisting() {
      const { data, error } = await client.from('event_occurrences').select(`
        id,event_id,occurrence_fingerprint,starts_at,ends_at,missing_since,archived_at,source_updated_at,
        events!inner(provider,source_group_id),event_attendees(id)
      `).eq('events.provider', 'tel_aviv_digitel');
      if (error) throw new Error(`Could not load existing occurrences: ${error.message}`);
      return (data ?? []).map((row: any) => ({
        occurrenceId: row.id, eventId: row.event_id, occurrenceFingerprint: row.occurrence_fingerprint,
        startsAt: row.starts_at, endsAt: row.ends_at, provider: row.events.provider,
        sourceGroupId: row.events.source_group_id,
        missingSince: row.missing_since, archivedAt: row.archived_at, sourceUpdatedAt: row.source_updated_at,
        hasAttendees: Array.isArray(row.event_attendees) && row.event_attendees.length > 0,
      }));
    },
    async applyCompleteSync(input) {
      const { data, error } = await client.rpc('apply_complete_digitel_sync', {
        p_run_id: input.runId, p_observed_at: input.observedAt, p_candidates: input.candidates,
      });
      if (error) throw new Error(`Atomic DigiTel sync failed: ${error.message}`);
      return data;
    },
  };
}

function isRequestBody(value: unknown): value is { dryRun: boolean } {
  return typeof value === 'object' && value !== null && Object.keys(value).length === 1 && typeof (value as { dryRun?: unknown }).dryRun === 'boolean';
}

function isServiceRole(authorization: string | null): boolean {
  const token = authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  try {
    const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')), (character) => character.charCodeAt(0))));
    return payload.role === 'service_role';
  } catch { return false; }
}

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

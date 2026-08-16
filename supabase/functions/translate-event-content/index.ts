// @ts-nocheck -- Supabase Edge Functions provide Deno and npm: imports at runtime.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { runEventTranslationBatch, type EventTranslationJob, type TranslationDatabase } from './handler.ts';
import { createOpenAiTranslationProvider } from './openAiProvider.ts';

const headers = { 'Content-Type': 'application/json' };

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' });
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!isServiceRole(request.headers.get('authorization'), serviceKey)) return json(403, { error: 'FORBIDDEN' });
  let body: unknown;
  try { body = await request.json(); } catch { return json(400, { error: 'INVALID_REQUEST' }); }
  if (!isInput(body)) return json(400, { error: 'INVALID_REQUEST' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const apiKey = Deno.env.get('OPENAI_API_KEY') ?? '';
  if (!supabaseUrl || !serviceKey || !apiKey) return json(500, { error: 'CONFIGURATION_MISSING' });
  const client = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const provider = createOpenAiTranslationProvider({ apiKey, model: Deno.env.get('EVENT_TRANSLATION_MODEL') ?? undefined });
    return json(200, await runEventTranslationBatch(body, createDatabase(client), provider));
  } catch {
    return json(502, { error: 'TRANSLATION_BATCH_FAILED' });
  }
});

function createDatabase(client: any): TranslationDatabase {
  const mapJob = (row: any): EventTranslationJob => ({
    eventId: row.event_id,
    title: row.title ?? row.events?.title,
    description: row.description ?? row.events?.description ?? null,
    sourceUpdatedAt: row.source_updated_at,
  });
  return {
    async enqueue(provider) {
      const { data, error } = await client.rpc('enqueue_event_translation_jobs', { p_provider: provider });
      if (error) throw new Error('QUEUE_UNAVAILABLE');
      return Number(data ?? 0);
    },
    async preview(limit) {
      const { data, error } = await client.from('event_translation_jobs')
        .select('event_id,source_updated_at,events!inner(title,description)')
        .in('status', ['pending', 'retry']).lte('next_attempt_at', new Date().toISOString())
        .order('next_attempt_at').limit(limit);
      if (error) throw new Error('QUEUE_UNAVAILABLE');
      return (data ?? []).map(mapJob);
    },
    async claim(limit) {
      const { data, error } = await client.rpc('claim_event_translation_jobs', { p_limit: limit });
      if (error) throw new Error('QUEUE_UNAVAILABLE');
      return (data ?? []).map(mapJob);
    },
    async save(job, rows, provider, model) {
      if (rows.length) {
        const { error } = await client.from('event_content_translations').upsert(rows.map((row) => ({
          event_id: job.eventId, locale: row.locale, source_language: row.sourceLanguage,
          source_fingerprint: row.sourceFingerprint, translated_title: row.title,
          translated_description: row.description, translation_provider: provider,
          translation_model: model, updated_at: new Date().toISOString(),
        })), { onConflict: 'event_id,locale' });
        if (error) throw new Error('CACHE_WRITE_FAILED');
      }
      const { data, error } = await client.from('event_translation_jobs').update({
        status: 'complete', locked_at: null, last_error_code: null, updated_at: new Date().toISOString(),
      }).eq('event_id', job.eventId).eq('source_updated_at', job.sourceUpdatedAt).select('event_id');
      if (error) throw new Error('QUEUE_UPDATE_FAILED');
      return (data ?? []).length === 1;
    },
    async fail(job, code) {
      const { error } = await client.from('event_translation_jobs').update({
        status: 'retry', locked_at: null, last_error_code: code,
        next_attempt_at: new Date(Date.now() + 15 * 60_000).toISOString(), updated_at: new Date().toISOString(),
      }).eq('event_id', job.eventId).eq('source_updated_at', job.sourceUpdatedAt);
      if (error) throw new Error('QUEUE_UPDATE_FAILED');
    },
  };
}

function isInput(value: unknown): value is { dryRun: boolean; limit?: number } {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).every((key) => key === 'dryRun' || key === 'limit')
    && typeof record.dryRun === 'boolean'
    && (record.limit === undefined || (typeof record.limit === 'number' && Number.isInteger(record.limit) && record.limit >= 1 && record.limit <= 50));
}

function isServiceRole(authorization: string | null, serviceKey: string): boolean {
  const token = authorization?.replace(/^Bearer\s+/i, '');
  return Boolean(serviceKey && token && token === serviceKey);
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

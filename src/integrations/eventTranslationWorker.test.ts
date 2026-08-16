import assert from 'node:assert/strict';
import test from 'node:test';
import { runEventTranslationBatch, type EventTranslationJob, type TranslationDatabase } from '../../supabase/functions/translate-event-content/handler.ts';
import { TranslationProviderError, type EventTranslationProvider } from '../../supabase/functions/translate-event-content/provider.ts';
import { createOpenAiTranslationProvider } from '../../supabase/functions/translate-event-content/openAiProvider.ts';
import type { CachedEventTranslation } from '../../supabase/functions/_shared/eventTranslation.ts';

const job: EventTranslationJob = {
  eventId: '11111111-1111-4111-8111-111111111111', title: 'שעת סיפור',
  description: 'פעילות למשפחות', sourceUpdatedAt: '2026-08-16T10:00:00Z',
};

class FakeDatabase implements TranslationDatabase {
  jobs: EventTranslationJob[] = [job];
  saved: CachedEventTranslation[] = [];
  failures: string[] = [];
  enqueued = 0;
  stale = false;
  async enqueue() { this.enqueued += 1; return 1; }
  async preview(limit: number) { return this.jobs.slice(0, limit); }
  async claim(limit: number) { return this.jobs.slice(0, limit); }
  async save(_job: EventTranslationJob, rows: CachedEventTranslation[]) { this.saved.push(...rows); return !this.stale; }
  async fail(_job: EventTranslationJob, code: string) { this.failures.push(code); }
}

const provider: EventTranslationProvider = {
  name: 'fixture', model: 'fixture-v1',
  async translate(input) {
    return { translations: input.targetLocales.map((locale) => ({ locale, title: `${locale}:${input.content.title}`, description: input.content.description ? `${locale}:${input.content.description}` : null })) };
  },
};

test('worker translates Hebrew to EN/FR/RU once and persists a shared cache', async () => {
  const database = new FakeDatabase();
  const result = await runEventTranslationBatch({ dryRun: false, limit: 20 }, database, provider);
  assert.equal(result.translated, 1);
  assert.deepEqual(database.saved.map((row) => row.locale), ['en', 'fr', 'ru']);
  assert.equal(new Set(database.saved.map((row) => row.sourceFingerprint)).size, 1);
});

test('dry run performs no enqueue, provider call or cache write', async () => {
  const database = new FakeDatabase();
  let calls = 0;
  const result = await runEventTranslationBatch({ dryRun: true, limit: 8 }, database, { ...provider, translate: async (input) => { calls += 1; return provider.translate(input); } });
  assert.equal(result.claimed, 1);
  assert.equal(database.enqueued, 0);
  assert.equal(calls, 0);
  assert.equal(database.saved.length, 0);
});

test('provider failure marks retry and does not reject the batch', async () => {
  const database = new FakeDatabase();
  const result = await runEventTranslationBatch({ dryRun: false, limit: 20 }, database, {
    ...provider, translate: async () => { throw new TranslationProviderError('PROVIDER_UNAVAILABLE'); },
  });
  assert.equal(result.failed, 1);
  assert.deepEqual(database.failures, ['PROVIDER_UNAVAILABLE']);
  assert.equal(database.saved.length, 0);
});

test('source changed during provider call is stale, never silently accepted', async () => {
  const database = new FakeDatabase();
  database.stale = true;
  const result = await runEventTranslationBatch({ dryRun: false, limit: 20 }, database, provider);
  assert.equal(result.stale, 1);
  assert.equal(result.translated, 0);
});

test('OpenAI boundary uses server fetch, store=false and structured output without leaking its key', async () => {
  let requestBody = '';
  let authorization = '';
  const openai = createOpenAiTranslationProvider({
    apiKey: 'fixture-secret-never-return', model: 'fixture-model',
    fetch: async (_url, init) => {
      requestBody = String(init?.body ?? '');
      authorization = new Headers(init?.headers).get('Authorization') ?? '';
      return new Response(JSON.stringify({ output_text: JSON.stringify({ translations: [
        { locale: 'en', title: 'Story time', description: 'For families' },
        { locale: 'fr', title: 'Heure du conte', description: 'Pour les familles' },
        { locale: 'ru', title: 'Час сказок', description: 'Для семей' },
      ] }) }), { status: 200 });
    },
  });
  const result = await openai.translate({ content: { title: job.title, description: job.description }, sourceLanguage: 'he', targetLocales: ['en', 'fr', 'ru'] });
  assert.equal(result.translations.length, 3);
  assert.equal(JSON.parse(requestBody).store, false);
  assert.equal(JSON.parse(requestBody).text.format.type, 'json_schema');
  assert.match(authorization, /^Bearer /);
  assert.doesNotMatch(JSON.stringify(result), /fixture-secret/);
});

test('OpenAI malformed response is mapped without returning raw provider data', async () => {
  const openai = createOpenAiTranslationProvider({ apiKey: 'fixture', fetch: async () => new Response('{"internal":"raw"}', { status: 200 }) });
  await assert.rejects(
    openai.translate({ content: { title: job.title, description: null }, sourceLanguage: 'he', targetLocales: ['en'] }),
    (error: unknown) => error instanceof TranslationProviderError && error.code === 'MALFORMED_RESPONSE' && !error.message.includes('raw'),
  );
});

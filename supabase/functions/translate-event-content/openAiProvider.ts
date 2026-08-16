import type { EventContentLocale } from '../_shared/eventTranslation.ts';
import { TranslationProviderError, type EventTranslationProvider, type TranslationProviderResult } from './provider.ts';

const RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-5-mini';
const TIMEOUT_MS = 25_000;

export function createOpenAiTranslationProvider(configuration: {
  apiKey: string;
  model?: string;
  fetch?: typeof fetch;
}): EventTranslationProvider {
  const apiKey = configuration.apiKey.trim();
  if (!apiKey) throw new TranslationProviderError('CONFIGURATION_MISSING');
  const model = configuration.model?.trim() || DEFAULT_MODEL;
  const fetcher = configuration.fetch ?? fetch;
  return {
    name: 'openai',
    model,
    async translate(input) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetcher(RESPONSES_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            store: false,
            max_output_tokens: 2_000,
            input: [
              {
                role: 'system',
                content: [{
                  type: 'input_text',
                  text: 'Translate official family-event copy faithfully. Preserve URLs, phone numbers, proper nouns, addresses, dates and formatting meaning. Return only the requested locales. Never add facts, prices, ages, registration claims or cancellation information.',
                }],
              },
              {
                role: 'user',
                content: [{ type: 'input_text', text: JSON.stringify(input) }],
              },
            ],
            text: {
              format: {
                type: 'json_schema',
                name: 'event_translations',
                strict: true,
                schema: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    translations: {
                      type: 'array',
                      items: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                          locale: { type: 'string', enum: ['en', 'he', 'fr', 'ru'] },
                          title: { type: 'string' },
                          description: { type: ['string', 'null'] },
                        },
                        required: ['locale', 'title', 'description'],
                      },
                    },
                  },
                  required: ['translations'],
                },
              },
            },
          }),
        });
      } catch (error) {
        if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') {
          throw new TranslationProviderError('TIMEOUT');
        }
        throw new TranslationProviderError('PROVIDER_UNAVAILABLE');
      } finally {
        clearTimeout(timeout);
      }
      if (response.status === 429) throw new TranslationProviderError('RATE_LIMITED');
      if (!response.ok) throw new TranslationProviderError('PROVIDER_UNAVAILABLE');
      let body: unknown;
      try { body = await response.json(); } catch { throw new TranslationProviderError('MALFORMED_RESPONSE'); }
      return validateProviderResult(parseOutputText(body), input.targetLocales);
    },
  };
}

function parseOutputText(body: unknown): unknown {
  if (!body || typeof body !== 'object') throw new TranslationProviderError('MALFORMED_RESPONSE');
  const record = body as Record<string, unknown>;
  let text = typeof record.output_text === 'string' ? record.output_text : null;
  if (!text && Array.isArray(record.output)) {
    for (const item of record.output) {
      if (!item || typeof item !== 'object' || !Array.isArray((item as Record<string, unknown>).content)) continue;
      for (const content of (item as { content: unknown[] }).content) {
        if (content && typeof content === 'object' && typeof (content as Record<string, unknown>).text === 'string') {
          text = (content as { text: string }).text;
          break;
        }
      }
      if (text) break;
    }
  }
  if (!text) throw new TranslationProviderError('MALFORMED_RESPONSE');
  try { return JSON.parse(text); } catch { throw new TranslationProviderError('MALFORMED_RESPONSE'); }
}

function validateProviderResult(value: unknown, targets: EventContentLocale[]): TranslationProviderResult {
  if (!value || typeof value !== 'object' || !Array.isArray((value as Record<string, unknown>).translations)) {
    throw new TranslationProviderError('MALFORMED_RESPONSE');
  }
  const requested = new Set(targets);
  const seen = new Set<EventContentLocale>();
  const translations = (value as { translations: unknown[] }).translations.map((raw) => {
    if (!raw || typeof raw !== 'object') throw new TranslationProviderError('MALFORMED_RESPONSE');
    const row = raw as Record<string, unknown>;
    const locale = row.locale as EventContentLocale;
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    const description = row.description == null ? null : typeof row.description === 'string' ? row.description.trim() || null : undefined;
    if (!requested.has(locale) || seen.has(locale) || !title || description === undefined) {
      throw new TranslationProviderError('MALFORMED_RESPONSE');
    }
    seen.add(locale);
    return { locale, title, description };
  });
  if (seen.size !== requested.size) throw new TranslationProviderError('MALFORMED_RESPONSE');
  return { translations };
}

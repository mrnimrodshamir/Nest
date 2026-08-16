import type { EventContentLocale, EventSourceContent, EventSourceLanguage } from '../_shared/eventTranslation.ts';

export interface TranslationProviderResult {
  translations: Array<{
    locale: EventContentLocale;
    title: string;
    description: string | null;
  }>;
}

export interface EventTranslationProvider {
  readonly name: string;
  readonly model: string;
  translate(input: {
    content: EventSourceContent;
    sourceLanguage: EventSourceLanguage;
    targetLocales: EventContentLocale[];
  }): Promise<TranslationProviderResult>;
}

export class TranslationProviderError extends Error {
  readonly code: 'CONFIGURATION_MISSING' | 'RATE_LIMITED' | 'TIMEOUT' | 'PROVIDER_UNAVAILABLE' | 'MALFORMED_RESPONSE';

  constructor(code: 'CONFIGURATION_MISSING' | 'RATE_LIMITED' | 'TIMEOUT' | 'PROVIDER_UNAVAILABLE' | 'MALFORMED_RESPONSE') {
    super(code);
    this.code = code;
    this.name = 'TranslationProviderError';
  }
}

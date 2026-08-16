export const EVENT_CONTENT_LOCALES = ['en', 'he', 'fr', 'ru'] as const;

export type EventContentLocale = (typeof EVENT_CONTENT_LOCALES)[number];
export type EventSourceLanguage = EventContentLocale | 'mixed' | 'unknown';

export interface EventSourceContent {
  title: string;
  description: string | null;
}

export interface CachedEventTranslation {
  locale: EventContentLocale;
  title: string;
  description: string | null;
  sourceLanguage: EventSourceLanguage;
  sourceFingerprint: string;
}

const HEBREW = /[\u0590-\u05ff]/g;
const CYRILLIC = /[\u0400-\u04ff]/g;
const LATIN = /[A-Za-zÀ-ÖØ-öø-ÿ]/g;
const FRENCH_SIGNAL = /[àâçéèêëîïôûùüÿœæ]|\b(?:avec|dans|des|les|pour|une|enfants?|familles?|atelier|spectacle)\b/i;

/** Conservative script/language detection for deciding which translations are
 * unnecessary. Mixed Hebrew/Latin content is intentionally `mixed`, so the
 * worker translates it for every locale instead of guessing. */
export function detectEventSourceLanguage(content: EventSourceContent): EventSourceLanguage {
  const text = `${content.title}\n${content.description ?? ''}`.trim();
  const hebrew = text.match(HEBREW)?.length ?? 0;
  const cyrillic = text.match(CYRILLIC)?.length ?? 0;
  const latin = text.match(LATIN)?.length ?? 0;
  if (hebrew > 0 && (latin > 0 || cyrillic > 0)) return 'mixed';
  if (cyrillic > 0 && latin > 0) return 'mixed';
  if (hebrew > 0) return 'he';
  if (cyrillic > 0) return 'ru';
  if (latin > 0) return FRENCH_SIGNAL.test(text) ? 'fr' : 'en';
  return 'unknown';
}

/** Fast deterministic content identity shared by the worker and mobile app.
 * This is an invalidation key, not a security primitive. Two independent
 * 32-bit FNV-1a passes plus byte length make accidental collisions vanishingly
 * unlikely for short Event copy without adding a crypto/native dependency. */
export function eventSourceFingerprint(content: EventSourceContent): string {
  const canonical = `${normalizeContent(content.title)}\u001f${normalizeContent(content.description ?? '')}`;
  const forward = fnv1a(canonical);
  const reverse = fnv1a([...canonical].reverse().join(''));
  return `event-content-v1-${forward}-${reverse}-${new TextEncoder().encode(canonical).length}`;
}

export function translationTargets(sourceLanguage: EventSourceLanguage): EventContentLocale[] {
  return EVENT_CONTENT_LOCALES.filter((locale) => locale !== sourceLanguage);
}

export function applyCachedEventTranslation<T extends EventSourceContent>(
  event: T,
  translation: CachedEventTranslation | null | undefined,
): T & { localizedContent?: CachedEventTranslation } {
  if (!translation || translation.sourceFingerprint !== eventSourceFingerprint(event)) return event;
  const title = normalizeContent(translation.title);
  if (!title) return event;
  return {
    ...event,
    localizedContent: {
      ...translation,
      title,
      description: normalizeOptionalContent(translation.description),
    },
  };
}

export function displayedEventContent(event: EventSourceContent & { localizedContent?: CachedEventTranslation }): EventSourceContent {
  return {
    title: event.localizedContent?.title || event.title,
    description: event.localizedContent?.description ?? event.description,
  };
}

function normalizeContent(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeOptionalContent(value: string | null): string | null {
  if (value == null) return null;
  return normalizeContent(value) || null;
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  applyCachedEventTranslation,
  detectEventSourceLanguage,
  displayedEventContent,
  eventSourceFingerprint,
  translationTargets,
  type CachedEventTranslation,
  type EventContentLocale,
} from '../../supabase/functions/_shared/eventTranslation.ts';
import { textAlignForContent } from '@/i18n/rtl';

const hebrew = { title: 'שעת סיפור', description: 'פעילות לילדים ולמשפחות' };
const english = { title: 'Story time', description: 'An activity for children and families' };

function cached(content: typeof hebrew, locale: EventContentLocale, title: string, description: string | null): CachedEventTranslation {
  return { locale, title, description, sourceLanguage: detectEventSourceLanguage(content), sourceFingerprint: eventSourceFingerprint(content) };
}

test('Hebrew source requests English, French and Russian without retranslating Hebrew', () => {
  assert.equal(detectEventSourceLanguage(hebrew), 'he');
  assert.deepEqual(translationTargets('he'), ['en', 'fr', 'ru']);
});

test('English source requests Hebrew and keeps all other supported targets', () => {
  assert.equal(detectEventSourceLanguage(english), 'en');
  assert.deepEqual(translationTargets('en'), ['he', 'fr', 'ru']);
});

test('Hebrew to English, French and Russian cached content resolves without touching the original', () => {
  for (const [locale, title] of [['en', 'Story time'], ['fr', 'Heure du conte'], ['ru', 'Час сказок']] as const) {
    const event = applyCachedEventTranslation(hebrew, cached(hebrew, locale, title, null));
    assert.equal(displayedEventContent(event).title, title);
    assert.equal(event.title, hebrew.title);
  }
});

test('English to Hebrew cached content resolves and follows displayed-content RTL', () => {
  const event = applyCachedEventTranslation(english, cached(english, 'he', 'שעת סיפור', 'פעילות למשפחות'));
  const shown = displayedEventContent(event);
  assert.equal(shown.title, 'שעת סיפור');
  assert.equal(textAlignForContent(shown.title, 'en').writingDirection, 'rtl');
});

test('English, French and Russian displayed translations remain LTR on a Hebrew UI', () => {
  for (const title of ['Story time', 'Heure du conte', 'Час сказок']) {
    assert.equal(textAlignForContent(title, 'he').writingDirection, 'ltr');
  }
});

test('same cached translation is reusable and changed source invalidates it', () => {
  const translation = cached(hebrew, 'en', 'Story time', 'For families');
  assert.equal(displayedEventContent(applyCachedEventTranslation(hebrew, translation)).title, 'Story time');
  assert.equal(displayedEventContent(applyCachedEventTranslation({ ...hebrew }, translation)).title, 'Story time');
  const changed = { ...hebrew, description: 'תוכן חדש' };
  const stale = applyCachedEventTranslation(changed, translation);
  assert.equal(displayedEventContent(stale).title, hebrew.title);
  assert.equal('localizedContent' in stale, false);
});

test('missing translation/provider failure always falls back to original content', () => {
  assert.deepEqual(displayedEventContent(applyCachedEventTranslation(hebrew, null)), hebrew);
  assert.deepEqual(displayedEventContent(applyCachedEventTranslation(hebrew, { ...cached(hebrew, 'en', '', null) })), hebrew);
});

test('missing description stays null and does not invent copy', () => {
  const content = { title: 'Story time', description: null };
  const event = applyCachedEventTranslation(content, cached(content as typeof hebrew, 'he', 'שעת סיפור', null));
  assert.equal(displayedEventContent(event).description, null);
});

test('mixed Hebrew and English is explicit rather than guessed', () => {
  assert.equal(detectEventSourceLanguage({ title: 'Story time שעת סיפור', description: '2026' }), 'mixed');
  assert.deepEqual(translationTargets('mixed'), ['en', 'he', 'fr', 'ru']);
});

test('client reads cached rows only and never calls a translation provider', async () => {
  const events = await readFile(new URL('../lib/events.ts', import.meta.url), 'utf8');
  const discovery = await readFile(new URL('../hooks/useDiscoveryEvents.ts', import.meta.url), 'utf8');
  const details = await readFile(new URL('../hooks/useEventDetails.ts', import.meta.url), 'utf8');
  assert.match(events, /from\('event_content_translations'\)/);
  assert.doesNotMatch(events + discovery + details, /api\.openai\.com|OPENAI_API_KEY|translate-event-content/);
  assert.match(discovery, /setEvents\(result\)[\s\S]*localizeEvents/);
  assert.match(details, /setEvent\(original\)[\s\S]*localizeEvents/);
});

test('translation provider credentials stay inside the service-role-only Edge Function', async () => {
  const worker = await readFile(new URL('../../supabase/functions/translate-event-content/index.ts', import.meta.url), 'utf8');
  const provider = await readFile(new URL('../../supabase/functions/translate-event-content/openAiProvider.ts', import.meta.url), 'utf8');
  assert.match(worker, /token === serviceKey/);
  assert.match(provider, /OPENAI|api\.openai\.com|Authorization/);
  assert.doesNotMatch(worker + provider, /EXPO_PUBLIC_OPENAI|fixture-secret-never-return/);
});

test('migration is additive, cached, fingerprinted and server-write-only', async () => {
  const sql = await readFile(new URL('../../supabase/migrations/20260816193000_event_content_translations.sql', import.meta.url), 'utf8');
  assert.match(sql, /create table if not exists public\.event_content_translations/i);
  assert.match(sql, /unique \(event_id, locale\)/i);
  assert.match(sql, /source_fingerprint text not null/i);
  assert.match(sql, /translated_title text not null/i);
  assert.match(sql, /revoke insert, update, delete[\s\S]*from anon, authenticated/i);
  assert.match(sql, /event_translation_jobs/i);
  assert.match(sql, /for update skip locked/i);
  assert.match(sql, /ROLLBACK/i);
  assert.doesNotMatch(sql, /alter table public\.events[\s\S]*drop|delete from public\.events/i);
});

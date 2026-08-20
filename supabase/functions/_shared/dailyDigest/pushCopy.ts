/** Server-side push shell copy for the Daily Digest notification.
 *
 *  Deliberately a small, separately-maintained dictionary rather than an
 *  import of `src/i18n/*` — this code runs in a Deno edge function, and
 *  `src/i18n` sits inside a React Native app with tooling that assumes a
 *  Metro/RN build, not Deno. The wording here is kept in step with
 *  `profile.support.title`-style tone used elsewhere in the app (warm,
 *  simple, one line), and MUST stay in sync by hand with any future
 *  `dailyDigest.*` client-facing i18n keys describing the same feature.
 *
 *  Event titles/facts are NEVER machine-translated here — only this shell
 *  (title + count-aware body) is localized. The events themselves are
 *  passed through using whatever presentation the app already applies. */

export const DIGEST_LOCALES = ['en', 'he', 'fr', 'ru', 'ar', 'es'] as const;
export type DigestLocale = (typeof DIGEST_LOCALES)[number];

interface DigestCopyEntry {
  title: string;
  body: (count: number) => string;
}

const COPY: Record<DigestLocale, DigestCopyEntry> = {
  en: {
    title: 'What’s on today in Tel Aviv?',
    body: (count) => (count === 1
      ? 'We found 1 family-friendly idea for today 👇'
      : `We found ${count} family-friendly ideas for today 👇`),
  },
  he: {
    title: 'מה עושים היום בתל אביב?',
    body: (count) => (count === 1
      ? 'מצאנו רעיון אחד למשפחות להיום 👇'
      : `מצאנו ${count} רעיונות למשפחות להיום 👇`),
  },
  fr: {
    title: 'Quoi de neuf aujourd’hui à Tel Aviv ?',
    body: (count) => (count === 1
      ? 'Nous avons trouvé 1 idée pour les familles aujourd’hui 👇'
      : `Nous avons trouvé ${count} idées pour les familles aujourd’hui 👇`),
  },
  ru: {
    title: 'Что интересного сегодня в Тель-Авиве?',
    // Phrased as a counter, like the rest of the Russian dictionary, so the
    // noun never has to grammatically agree with an unknown {count}.
    body: (count) => `Идеи для семьи на сегодня: ${count} 👇`,
  },
  ar: {
    title: 'ماذا يحدث اليوم في تل أبيب؟',
    body: (count) => (count === 1
      ? 'وجدنا فكرة واحدة للعائلات اليوم 👇'
      : `عدد الأفكار للعائلات اليوم: ${count} 👇`),
  },
  es: {
    title: '¿Qué hacer hoy en Tel Aviv?',
    body: (count) => (count === 1
      ? 'Encontramos 1 idea para familias hoy 👇'
      : `Encontramos ${count} ideas para familias hoy 👇`),
  },
};

export function isDigestLocale(value: string | null | undefined): value is DigestLocale {
  return !!value && (DIGEST_LOCALES as readonly string[]).includes(value);
}

/** Falls back to English for an unrecognized/missing locale — never returns
 *  an empty push, since a push with no shell copy is worse than an English
 *  one. `count` must be the actual number of events in THIS user's digest. */
export function buildDigestPushCopy(locale: string | null | undefined, count: number): { title: string; body: string } {
  const entry = COPY[isDigestLocale(locale) ? locale : 'en'];
  return { title: entry.title, body: entry.body(count) };
}

import { translate, type AppLocale } from '@/i18n/core';

/** The one support inbox for the whole product — reused verbatim by the
 *  website's /privacy and /support pages and its footer "Contact" links
 *  (website/index.html, website/en/index.html), so this must never drift
 *  from those. */
export const SUPPORT_EMAIL = 'nimrodshamir@nestup.best';

/** Builds a mailto: link pre-filled with a localized subject only.
 *
 *  Deliberately carries no user data at all — not even a display name or
 *  user id — so a support email can never leak private profile, child,
 *  auth, or session information just by existing as a link. Anything the
 *  user wants to share, they type themselves. */
export function buildSupportMailtoUrl(locale: AppLocale): string {
  const subject = translate(locale, 'profile.support.subject');
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

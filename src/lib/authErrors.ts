/** Maps raw Supabase Auth error text to warm, actionable product copy.
 *  Never show a raw backend/provider error string to the user — the
 *  original message is only ever logged (see callers), never rendered. */
export function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  let key: TranslationKey = 'auth.error.generic';

  if (/rate limit/.test(m)) {
    key = 'auth.error.tooMany';
  } else if (/already registered|already exists|user_already_exists/.test(m)) key = 'auth.error.accountExists';
  else if (/invalid login credentials|invalid_credentials/.test(m)) key = 'auth.error.invalidCredentials';
  else if (/email not confirmed|email_not_confirmed/.test(m)) key = 'auth.error.emailUnconfirmed';
  else if (/password should be at least|password.*(weak|short|characters)/.test(m)) key = 'auth.error.weakPassword';
  else if (/invalid email|unable to validate email|invalid format/.test(m)) key = 'auth.error.invalidEmail';
  else if (/network|fetch failed|timed? ?out|offline/.test(m)) key = 'auth.error.network';
  return translate(currentAppLocale(), key);
}
import { currentAppLocale, translate, type TranslationKey } from '@/i18n';

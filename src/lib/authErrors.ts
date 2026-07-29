/** Maps raw Supabase Auth error text to warm, actionable product copy.
 *  Never show a raw backend/provider error string to the user — the
 *  original message is only ever logged (see callers), never rendered. */
export function mapAuthError(message: string): string {
  const m = message.toLowerCase();

  if (/rate limit/.test(m)) {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }
  if (/already registered|already exists|user_already_exists/.test(m)) {
    return 'An account already exists with this email. Try logging in instead.';
  }
  if (/invalid login credentials|invalid_credentials/.test(m)) {
    return 'The email or password is incorrect.';
  }
  if (/email not confirmed|email_not_confirmed/.test(m)) {
    return 'Please confirm your email before logging in.';
  }
  if (/password should be at least|password.*(weak|short|characters)/.test(m)) {
    return 'Password must be at least 8 characters.';
  }
  if (/invalid email|unable to validate email|invalid format/.test(m)) {
    return 'Enter a valid email address.';
  }
  if (/network|fetch failed|timed? ?out|offline/.test(m)) {
    return "We couldn't connect. Check your internet connection and try again.";
  }
  return 'Something went wrong. Please try again.';
}
